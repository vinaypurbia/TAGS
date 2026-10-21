import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.TAGS_MONGO;
let client;

async function getClient() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client;
}

// Kept in sync with inventory.js's identical helper — see the comment there.
// Call after ANY stock quantity change so "Synced" products stay accurate.
function computeStockStatusForVisibility(availableStock, lowStockAlert, trackInventory = true) {
  if (availableStock <= 0) return 'out_of_stock';
  if (trackInventory && availableStock <= (lowStockAlert || 5)) return 'low_stock';
  return 'in_stock';
}
function stockStatusToFrontendStatus(stockStatus) {
  if (stockStatus === 'out_of_stock') return 'out_of_stock';
  if (stockStatus === 'low_stock') return 'low_stock';
  return 'normal';
}
async function syncFrontendStatusIfAuto(inventoryCol, productId, invDoc) {
  if (!invDoc || invDoc.visibilityAutoManaged === false) return;
  const stockStatus = computeStockStatusForVisibility(invDoc.availableStock ?? 0, invDoc.lowStockAlert, invDoc.trackInventory !== false);
  await inventoryCol.updateOne({ productId }, { $set: { frontendStatus: stockStatusToFrontendStatus(stockStatus), updatedAt: new Date() } });
}

// Auto-generate PO number: PO-2026-001
async function generatePONumber(db) {
  const year = new Date().getFullYear();
  const count = await db.collection('purchaseOrders').countDocuments();
  return `PO-${year}-${String(count + 1).padStart(3, '0')}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const dbClient = await getClient();
    const db = dbClient.db('tagsdb');
    const orders = db.collection('purchaseOrders');
    const inventory = db.collection('inventory');
    const movements = db.collection('stockMovements');
    const cashFlow = db.collection('cashFlow');
    const ledgerCol = db.collection('ledgerEntries');
    const archive = db.collection('correctionArchive');

    // What did this PO's receipts do to one product, and how much of that has already been corrected?
    // Uses only the PO's own receipt records (balance before the first receipt, balance after the last),
    // so sales and manual edits can't skew it; if other changes landed in between it can only UNDER-count.
    const CORRECTION_PREFIX = 'Duplicate receipt correction — ';
    const receiptFacts = async (pid, poId, poNumber, lineCountForPid, poQtyForPid) => {
      const receipts = await movements.find({ productId: pid, referenceId: poId, reason: 'purchase_order' }).sort({ createdAt: 1 }).toArray();
      const inv = await inventory.findOne({ productId: pid });
      const first = receipts[0], last = receipts[receipts.length - 1];
      const duplicated = receipts.length > lineCountForPid;
      const extra = duplicated ? Math.max(0, (Number(last.balanceAfter) || 0) - (Number(first.balanceBefore) || 0) - poQtyForPid) : 0;
      // The correction is recorded in the product's adjustment log in the SAME write that lowers the stock,
      // so "already corrected" can never be out of step with the stock itself.
      const corrected = (inv?.adjustmentLog || [])
        .filter(l => (l.reason || '').startsWith(CORRECTION_PREFIX + poNumber))
        .reduce((t, l) => t + Math.abs(Number(l.adjustment) || 0), 0);
      return { receipts, inv, first, last, duplicated, extra, corrected, uncorrected: Math.max(0, extra - corrected) };
    };

    // ─────────────────────────────────────────────
    // GET /api/purchase-orders
    // ?id=xxx  → single PO
    // ?status=ordered → filter by status
    // ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const { id, status } = req.query;

      // ── Correct a PO whose receipt got recorded more than once ─────────────────────────────────
      // GET /api/purchase-orders?action=fixDuplicateReceipts&poNumber=PO-2026-013             → PREVIEW (changes nothing)
      // GET /api/purchase-orders?action=fixDuplicateReceipts&poNumber=PO-2026-013&apply=FIX   → applies it
      // Stock: each product is lowered by the extra units this PO added (compare-and-set, so a sale that lands
      //   mid-correction stops it instead of being overwritten) and the change is written to its adjustment log.
      // Money: repeat transport / balance-payment / supplier-ledger entries are removed ONLY when they match the
      //   first one exactly; a copy of each is archived first. Safe to run more than once — nothing is corrected twice.
      if (req.query.action === 'fixDuplicateReceipts') {
        const po = id ? await orders.findOne({ _id: new ObjectId(id) }) : await orders.findOne({ poNumber: req.query.poNumber });
        if (!po) return res.status(404).json({ error: 'Purchase order not found — pass poNumber=PO-xxxx-xxx or id=...' });
        const poId = String(po._id);
        const apply = req.query.apply === 'FIX';
        const lines = po.receivedItems || po.items || [];

        const poQty = {}, names = {}, lineCount = {};
        for (const it of lines) {
          const q = Number(it.quantityReceived ?? it.quantity) || 0;
          poQty[it.productId] = (poQty[it.productId] || 0) + q;
          names[it.productId] = it.productName || it.productId;
          lineCount[it.productId] = (lineCount[it.productId] || 0) + 1;
        }

        // ── 1. what to do to each product's stock ──
        const stockPlan = [];
        for (const pid of Object.keys(poQty)) {
          const f = await receiptFacts(pid, poId, po.poNumber, lineCount[pid], poQty[pid]);
          const base = { product: names[pid], productId: pid };
          if (!f.inv) { stockPlan.push({ ...base, action: 'skipped', why: 'no inventory record for this product' }); continue; }
          const cur = Number(f.inv.currentStock) || 0;
          if (f.uncorrected <= 0) { stockPlan.push({ ...base, action: f.corrected > 0 ? 'already corrected' : 'nothing to fix', currentStock: cur }); continue; }
          if (cur < f.uncorrected) { stockPlan.push({ ...base, action: 'skipped', why: `current stock (${cur}) is lower than the extra (${f.uncorrected}) — check this one by hand`, currentStock: cur }); continue; }
          stockPlan.push({ ...base, action: 'correct', currentStock: cur, removeUnits: f.uncorrected, willBecome: cur - f.uncorrected, timesRecorded: f.receipts.length, _inv: f.inv });
        }

        // ── 2. which repeat money entries to remove (keep the earliest; only remove exact-amount repeats) ──
        const sameAmount = (a, b) => Math.abs((Number(a.amount) || 0) - (Number(b.amount) || 0)) < 0.005;
        const moneyPlans = [];
        for (const [label, col, coll, filter] of [
          ['Transport expense',                       cashFlow,  'cashFlow',      { referenceId: poId, referenceType: 'po_transport' }],
          ['Delivery balance payment',                cashFlow,  'cashFlow',      { referenceId: poId, referenceType: 'purchase_order' }],
          ["Supplier ledger: 'goods received' credit", ledgerCol, 'ledgerEntries', { referenceId: poId, referenceType: 'purchase_order', entryType: 'credit' }],
          ['Supplier ledger: shortage debit',         ledgerCol, 'ledgerEntries', { referenceId: poId, referenceType: 'po_shortage', entryType: 'debit' }],
        ]) {
          const all = (await col.find(filter).toArray()).sort((a, b) => (new Date(a.date) - new Date(b.date)) || String(a._id).localeCompare(String(b._id)));
          const keep = all[0];
          const remove = all.slice(1).filter(d => sameAmount(d, keep));
          const differentAmount = all.slice(1).filter(d => !sameAmount(d, keep));
          moneyPlans.push({ label, col, coll, found: all.length, keep, remove, differentAmount });
        }

        const toCorrect = stockPlan.filter(x => x.action === 'correct');
        const totalUnits = toCorrect.reduce((t, x) => t + x.removeUnits, 0);
        const publicStock = stockPlan.map(({ _inv, ...rest }) => rest);
        const publicMoney = moneyPlans.map(m => ({
          what: m.label, entriesFound: m.found, repeatsToRemove: m.remove.length, amountEach: m.keep ? m.keep.amount : null,
          ...(m.differentAmount.length ? { leftAloneCheckByHand: `${m.differentAmount.length} entr${m.differentAmount.length === 1 ? 'y has' : 'ies have'} a different amount, so nothing was removed for ${m.differentAmount.length === 1 ? 'it' : 'them'}` } : {}),
        }));

        if (!apply) {
          return res.status(200).json({
            mode: 'PREVIEW — nothing has been changed',
            po: po.poNumber,
            summary: `${toCorrect.length} products would be lowered by ${totalUnits} units in total; ${moneyPlans.reduce((t, m) => t + m.remove.length, 0)} repeat money entries would be removed.`,
            stock: publicStock,
            money: publicMoney,
            toApply: `Open the same link with &apply=FIX added at the end: /api/purchase-orders?action=fixDuplicateReceipts&poNumber=${po.poNumber}&apply=FIX`,
          });
        }

        // ── 3. apply ──
        const done = { stock: [], money: [] };
        for (const item of toCorrect) {
          const inv = item._inv, cur = item.currentStock, remove = item.removeUnits, newStock = cur - remove;
          const reserved = Number(inv.reservedStock) || 0;
          const available = Math.max(0, newStock - reserved);
          const alert = inv.lowStockAlert || 5;
          let stockStatus = 'in_stock';
          if (available === 0) stockStatus = 'out_of_stock';
          else if (available <= alert) stockStatus = 'low_stock';

          const w = await inventory.updateOne(
            { productId: item.productId, currentStock: cur },   // only if nobody has changed the stock since we looked
            {
              $set: { currentStock: newStock, availableStock: available, stockStatus, updatedAt: new Date() },
              $push: { adjustmentLog: { adjustment: -remove, reason: `${CORRECTION_PREFIX}${po.poNumber} (receipt was recorded ${item.timesRecorded} times)`, date: new Date(), stockAfter: newStock } },
            }
          );
          if (w.matchedCount !== 1) { done.stock.push({ product: item.product, result: 'NOT applied — the stock changed while correcting (a sale?). Run the link again.' }); continue; }
          await movements.insertOne({
            productId: item.productId, type: 'out', quantity: remove, reason: 'duplicate_receipt_correction', referenceId: poId,
            balanceBefore: cur, balanceAfter: newStock, note: `PO ${po.poNumber} was received ${item.timesRecorded} times — extra ${remove} removed`, createdAt: new Date(),
          });
          await syncFrontendStatusIfAuto(inventory, item.productId, { ...inv, availableStock: available });
          done.stock.push({ product: item.product, result: `${cur} → ${newStock}` });
        }
        for (const m of moneyPlans) {
          for (const d of m.remove) {
            await archive.insertOne({ archivedAt: new Date(), reason: `Repeat of an entry already recorded for ${po.poNumber}`, poNumber: po.poNumber, fromCollection: m.coll, original: d });
            const del = await m.col.deleteOne({ _id: d._id });
            done.money.push({ what: m.label, amount: d.amount, removed: del.deletedCount === 1 });
          }
        }
        await orders.updateOne({ _id: po._id }, { $set: { duplicateReceiptCorrection: { at: new Date(), unitsRemoved: totalUnits } } });

        return res.status(200).json({
          mode: 'APPLIED',
          po: po.poNumber,
          summary: `Corrected ${done.stock.filter(x => x.result.includes('→')).length} products (${totalUnits} units) and removed ${done.money.filter(x => x.removed).length} repeat money entries.`
            + (stockPlan.some(x => x.action === 'skipped') ? ` ${stockPlan.filter(x => x.action === 'skipped').length} product(s) were SKIPPED and need checking by hand — see "skipped".` : ''),
          stock: done.stock,
          skipped: stockPlan.filter(x => x.action === 'skipped').map(({ _inv, ...rest }) => rest),
          money: done.money,
          next: `Open /api/purchase-orders?action=receiveAudit&poNumber=${po.poNumber} again — it should now say 0 products still need correcting.`,
        });
      }

      // ── Receive audit (read-only, changes nothing) ─────────────────────────────────────────
      // GET /api/purchase-orders?action=receiveAudit&poNumber=PO-2026-013   (or &id=<po _id>)
      // For every product on the PO: how many times its stock was added for this PO, and where the
      // stock count should be now versus where it actually is. Based on the stock-movement records,
      // so a sale or manual edit that never wrote a movement isn't counted in "expectedStock".
      if (req.query.action === 'receiveAudit') {
        const po = id ? await orders.findOne({ _id: new ObjectId(id) }) : await orders.findOne({ poNumber: req.query.poNumber });
        if (!po) return res.status(404).json({ error: 'Purchase order not found — pass poNumber=PO-xxxx-xxx or id=...' });
        const poId = String(po._id);
        const lines = po.receivedItems || po.items || [];

        const poQty = {}, names = {}, lineCount = {};
        for (const it of lines) {
          const q = Number(it.quantityReceived ?? it.quantity) || 0;
          poQty[it.productId] = (poQty[it.productId] || 0) + q;
          names[it.productId] = it.productName || it.productId;
          lineCount[it.productId] = (lineCount[it.productId] || 0) + 1;
        }

        const rows = [];
        for (const pid of Object.keys(poQty)) {
          const receipts = await movements.find({ productId: pid, referenceId: poId, reason: 'purchase_order' }).sort({ createdAt: 1 }).toArray();
          const inv = await inventory.findOne({ productId: pid });
          const first = receipts[0], last = receipts[receipts.length - 1];
          const duplicated = receipts.length > lineCount[pid];
          const f = await receiptFacts(pid, poId, po.poNumber, lineCount[pid], poQty[pid]); // how much of the extra has already been corrected
          let otherNet = 0;
          let adjustments = [];
          if (first) {
            const others = await movements.find({ productId: pid, createdAt: { $gt: first.createdAt } }).toArray();
            for (const m of others) {
              if (m.referenceId === poId && m.reason === 'purchase_order') continue;
              if (m.reason === 'duplicate_receipt_correction') continue; // this audit's own fix — not a real sale/edit
              otherNet += (m.type === 'in' ? 1 : -1) * (Number(m.quantity) || 0);
            }
            // Changes made from the Inventory screen (manual edits, delivery backfills) only go into the
            // product's own adjustment log, never into stock movements. PO edits/returns/deletes write to
            // BOTH, so those are skipped here to avoid counting them twice.
            adjustments = (inv?.adjustmentLog || [])
              .filter(l => new Date(l.date) > new Date(first.createdAt) && !/^(PO Edit —|Return to supplier —|PO Deleted —)/.test(l.reason || ''))
              .map(l => ({ adjustment: l.adjustment, reason: l.reason, date: l.date }));
          }
          const startedFrom = first ? Number(first.balanceBefore) || 0 : null;
          const expectedStock = first ? Math.max(0, startedFrom + poQty[pid] + otherNet) : null;
          const currentStock = inv ? inv.currentStock : null;
          // The number to trust most: what this PO's own receipts did to the stock, beyond what the PO
          // calls for. Last receipt's balance-after minus first receipt's balance-before, minus the PO
          // quantity. Uses only this PO's records, so sales and manual edits can't skew it; if other
          // changes landed in between it can only UNDER-count, never over-count.
          const extraFromDuplicates = duplicated ? Math.max(0, (Number(last.balanceAfter) || 0) - (Number(first.balanceBefore) || 0) - poQty[pid]) : 0;
          rows.push({
            product: names[pid], productId: pid,
            poQuantity: poQty[pid],
            timesStockWasAdded: receipts.length,
            timesExpected: lineCount[pid],
            stockBeforeThisPO: startedFrom,
            extraUnitsFromDuplicateReceipts: extraFromDuplicates,
            alreadyCorrectedUnits: f.corrected,
            stillToCorrect: f.uncorrected,
            currentStock,
            approximate: {
              note: 'Counts only recorded stock movements, so it can be thrown off by sales or manual edits — see inventoryScreenAdjustmentsSince.',
              otherRecordedChangesSince: otherNet,
              expectedStock,
              looksInflatedBy: (expectedStock !== null && currentStock !== null) ? Math.max(0, currentStock - expectedStock) : null,
            },
            inventoryScreenAdjustmentsSince: adjustments,
          });
        }

        const cash = await cashFlow.find({ referenceId: poId, referenceType: { $in: ['po_transport', 'purchase_order', 'po_advance'] } }).toArray();
        const ledger = await ledgerCol.find({ referenceId: poId, referenceType: { $in: ['purchase_order', 'po_shortage', 'advance_payment'] } }).toArray();

        // Advance payments can legitimately happen more than once, so these are only FLAGGED: the same
        // amount recorded twice within a minute is far more likely a double-click than two real payments.
        const advances = cash.filter(c => c.referenceType === 'po_advance').sort((a, b) => new Date(a.date) - new Date(b.date));
        const possibleDuplicateAdvances = [];
        for (let i = 1; i < advances.length; i++) {
          const gap = Math.abs(new Date(advances[i].date) - new Date(advances[i - 1].date));
          if (Number(advances[i].amount) === Number(advances[i - 1].amount) && gap < 60000) possibleDuplicateAdvances.push({ amount: advances[i].amount, secondsApart: Math.round(gap / 1000) });
        }

        const duplicatedRows = rows.filter(r => r.timesStockWasAdded > r.timesExpected);
        const extraTotal = rows.reduce((t, r) => t + r.extraUnitsFromDuplicateReceipts, 0);
        const transportCount = cash.filter(c => c.referenceType === 'po_transport').length;
        const balanceCount = cash.filter(c => c.referenceType === 'purchase_order').length;
        const creditCount = ledger.filter(l => l.referenceType === 'purchase_order' && l.entryType === 'credit').length;
        return res.status(200).json({
          po: po.poNumber, status: po.status,
          summary: `${duplicatedRows.length} of ${rows.length} products had their stock added more times than the PO calls for; ${extraTotal} extra units in total come from that.`
            + ` ${rows.filter(r => r.stillToCorrect > 0).length} of ${rows.length} products still need their stock corrected (${rows.reduce((t, r) => t + r.stillToCorrect, 0)} extra units); ${rows.filter(r => r.alreadyCorrectedUnits > 0).length} already corrected.`
            + (transportCount > 1 ? ` Transport expense was recorded ${transportCount} times.` : '')
            + (balanceCount > 1 ? ` The delivery balance payment was recorded ${balanceCount} times.` : '')
            + (creditCount > 1 ? ` The supplier ledger has ${creditCount} 'goods received' credits for this PO.` : '')
            + (possibleDuplicateAdvances.length ? ` ${possibleDuplicateAdvances.length} advance payment(s) look like duplicates.` : ''),
          howToRead: 'extraUnitsFromDuplicateReceipts is the number to trust: it uses only this PO\'s own receipt records. Everything under "approximate" is a cross-check, not a verdict.',
          products: rows,
          moneyEntries: {
            note: 'Each of these should normally appear at most once per PO.',
            transportExpense: cash.filter(c => c.referenceType === 'po_transport').map(c => ({ amount: c.amount, date: c.date })),
            balancePaymentOnDelivery: cash.filter(c => c.referenceType === 'purchase_order').map(c => ({ amount: c.amount, date: c.date })),
            advancePayments: advances.map(c => ({ amount: c.amount, paymentMode: c.paymentMode, date: c.date })),
            possibleDuplicateAdvances,
            poTotals: { totalAmount: po.totalAmount, paidAmount: po.paidAmount, dueAmount: po.dueAmount },
            supplierLedger: ledger.map(l => ({ type: l.entryType, kind: l.referenceType, amount: l.amount, date: l.date })),
          },
        });
      }

      if (id) {
        const po = await orders.findOne({ _id: new ObjectId(id) });
        if (!po) return res.status(404).json({ error: 'Purchase order not found' });
        return res.status(200).json(po);
      }

      const filter = status ? { status } : {};
      const allOrders = await orders.find(filter).sort({ createdAt: -1 }).toArray();
      return res.status(200).json(allOrders);
    }

    // ─────────────────────────────────────────────
    // POST /api/purchase-orders
    // Create a new PO
    // Body: { supplier, items: [{productId, productName, sku, quantity, costPrice}], notes, expectedDate }
    // ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const { supplier, items, notes = '', expectedDate } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'At least one item is required' });
      }

      const enrichedItems = items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        costPrice: Number(item.costPrice),
        totalCost: Number(item.quantity) * Number(item.costPrice),
      }));

      const totalAmount = enrichedItems.reduce((sum, i) => sum + i.totalCost, 0);
      const poNumber = await generatePONumber(db);

      const newPO = {
        poNumber,
        supplier: supplier || { name: '', contact: '', email: '' },
        items: enrichedItems,
        status: 'draft',
        totalAmount,
        paidAmount: 0,
        dueAmount: totalAmount,
        notes,
        orderDate: null,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        receivedDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await orders.insertOne(newPO);
      return res.status(201).json({ success: true, _id: result.insertedId, poNumber });
    }

    // ─────────────────────────────────────────────
    // PUT /api/purchase-orders
    // Actions:
    //   "update"              → edit PO details (only if draft/ordered)
    //   "order"               → mark as ordered (draft → ordered)
    //   "receive"             → mark as received → AUTO adds stock to inventory
    //   "edit_received"       → correct qty/cost on a received PO, adjusts stock diff
    //   "advance_payment"     → record advance payment
    //   "pay"                 → record payment
    //   "cancel"              → cancel PO
    //   "resolve_shortage"    → resolve shortage via refund or goods
    //   "return_to_supplier"  → partial or full return, deducts stock, logs refund
    // ─────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id, action } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const po = await orders.findOne({ _id: new ObjectId(id) });
      if (!po) return res.status(404).json({ error: 'Purchase order not found' });

      // ── Edit draft or ordered PO ──
      if (action === 'update' || !action) {
        if (!['draft', 'ordered'].includes(po.status)) {
          return res.status(400).json({ error: 'Only draft or ordered POs can be edited. Use edit_received for received POs.' });
        }
        const { supplier, items, notes, expectedDate } = req.body;
        const updateFields = { updatedAt: new Date() };
        if (supplier) updateFields.supplier = supplier;
        if (notes !== undefined) updateFields.notes = notes;
        if (expectedDate) updateFields.expectedDate = new Date(expectedDate);
        if (items) {
          const enrichedItems = items.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
            costPrice: Number(item.costPrice),
            totalCost: Number(item.quantity) * Number(item.costPrice),
          }));
          updateFields.items = enrichedItems;
          updateFields.totalAmount = enrichedItems.reduce((s, i) => s + i.totalCost, 0);
          updateFields.dueAmount = updateFields.totalAmount - po.paidAmount;
        }
        await orders.updateOne({ _id: new ObjectId(id) }, { $set: updateFields });
        return res.status(200).json({ success: true });
      }

      // ── Mark as ordered ──
      if (action === 'order') {
        if (po.status !== 'draft') {
          return res.status(400).json({ error: 'PO is not in draft status' });
        }
        await orders.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: 'ordered', orderDate: new Date(), updatedAt: new Date() } }
        );
        return res.status(200).json({ success: true });
      }

      // ── Advance Payment ──
      if (action === 'advance_payment') {
        const { amount, paymentMode: pmMode, notes: pmNotes } = req.body;
        const paid = Number(amount);
        if (!paid || paid <= 0) return res.status(400).json({ error: 'Valid amount required' });
        const newPaid = (po.paidAmount || 0) + paid;
        const newDue = Math.max(0, po.totalAmount - newPaid);
        await orders.updateOne({ _id: new ObjectId(id) }, { $set: { paidAmount: newPaid, dueAmount: newDue, updatedAt: new Date() } });

        // ── Cashflow entry ──
        await cashFlow.insertOne({
          type: 'expense', category: 'advance_payment', amount: paid,
          paymentMode: pmMode || 'cash',
          description: `Advance Payment — PO ${po.poNumber} — ${po.supplier?.name || 'Supplier'}${pmNotes ? ` — ${pmNotes}` : ''}`,
          referenceId: id, referenceType: 'po_advance',
          supplierName: po.supplier?.name || '', poNumber: po.poNumber,
          date: new Date(), createdAt: new Date(),
        });

        // ── Ledger entry — debit on supplier (we paid them) ──
        let resolvedSupplierId = po.supplierId || null;
        if (!resolvedSupplierId && po.supplier?.name) {
          const supplierDoc = await db.collection('suppliers').findOne({ name: po.supplier.name });
          if (supplierDoc) resolvedSupplierId = supplierDoc._id.toString();
        }
        if (resolvedSupplierId) {
          await ledgerCol.insertOne({
            partyType: 'supplier', partyId: resolvedSupplierId,
            partyName: po.supplier?.name || '',
            entryType: 'debit',
            amount: paid,
            description: `Advance Payment — PO ${po.poNumber}${pmNotes ? ` — ${pmNotes}` : ''}`,
            referenceType: 'advance_payment', referenceId: id,
            paymentMode: pmMode || 'cash',
            notes: pmNotes || '',
            date: new Date(), createdAt: new Date(),
          });
        }

        return res.status(200).json({ success: true, paidAmount: newPaid, dueAmount: newDue });
      }

      // ── Mark as received with per-item quantities + shortage/damage detection ──
      if (action === 'receive') {
        if (!['ordered', 'draft'].includes(po.status)) {
          return res.status(400).json({ error: 'PO cannot be received in current status' });
        }

        // Atomic claim: only ONE request at a time may receive a given PO. Before this, a double-click or a
        // retry after a slow response could each pass the status check above (the PO only flips to 'received'
        // at the very end, after all the stock writes) and each add the full stock again. A claim older than
        // 2 minutes counts as abandoned (e.g. the server timed out part-way), so the PO can be received again —
        // items already received are skipped below, so nothing is added twice.
        const claim = await orders.updateOne(
          { _id: new ObjectId(id), status: { $in: ['ordered', 'draft'] }, receiveLockAt: { $not: { $gt: new Date(Date.now() - 120000) } } },
          { $set: { receiveLockAt: new Date() } }
        );
        if (claim.modifiedCount !== 1) {
          return res.status(409).json({ error: 'This PO is already being received. Wait a moment, refresh, and check its status before trying again.' });
        }
        try {
        const receivedItems = req.body.receivedItems || po.items.map(i => ({ ...i, quantityReceived: i.quantity, damageNotes: '' }));
        const { paymentMode: poPaymentMode, transportCost: rawTransportCost, transportPaymentMode, transportNotes } = req.body;
        let totalOrdered = 0, totalReceived = 0, totalReceivedValue = 0, totalShortageValue = 0;
        const shortageItems = [];

        // ── Transport cost: split PROPORTIONALLY by each item's received value
        // (costPrice × qty received), not equally per line. This way a ₹10
        // item doesn't carry the same rupee burden as a ₹1000 item — each
        // item absorbs transport cost in proportion to how much of the total
        // shipment value it represents. Falls back to an equal split only if
        // every receiving item has a ₹0 cost price (so proportions can't be
        // computed).
        const transportCost = Number(rawTransportCost) || 0;
        const itemsReceivingStock = receivedItems.filter(item => Number(item.quantityReceived ?? item.quantity) > 0);
        const totalReceivingValue = itemsReceivingStock.reduce((sum, item) => sum + (Number(item.quantityReceived ?? item.quantity) * (Number(item.costPrice) || 0)), 0);

        for (const [lineIdx, item] of receivedItems.entries()) {
          const orderedQty = Number(item.quantity);
          const receivedQty = Number(item.quantityReceived ?? item.quantity);
          const shortageQty = orderedQty - receivedQty;
          const costP = Number(item.costPrice) || 0;
          totalOrdered += orderedQty; totalReceived += receivedQty;
          totalReceivedValue += receivedQty * costP;
          if (shortageQty > 0) {
            totalShortageValue += shortageQty * costP;
            shortageItems.push({ productId: item.productId, productName: item.productName, orderedQty, receivedQty, shortageQty, costPrice: costP, shortageValue: shortageQty * costP, damageNotes: item.damageNotes || '' });
          }
          if (receivedQty <= 0) continue;

          // This item's proportional share of transport cost, based on its
          // value (costPrice × qty) as a fraction of the total shipment value
          const itemValue = receivedQty * costP;
          const itemTransportShare = totalReceivingValue > 0
            ? (itemValue / totalReceivingValue) * transportCost
            : (itemsReceivingStock.length > 0 ? transportCost / itemsReceivingStock.length : 0); // fallback: equal split when all cost prices are 0
          const perUnitTransportCost = itemTransportShare / receivedQty;
          const landedCostPrice = costP + perUnitTransportCost;
          // Record the transport allocation back onto the item for the audit trail
          item.transportCostShare = itemTransportShare;
          item.landedCostPrice = landedCostPrice;

          // This PO line already added its stock (an earlier attempt got part-way before failing)? Skip it.
          if (await movements.findOne({ productId: item.productId, referenceId: id, reason: 'purchase_order', poLine: lineIdx })) continue;

          const existing = await inventory.findOne({ productId: item.productId });
          if (existing) {
            const balanceBefore = existing.currentStock;
            const newStock = existing.currentStock + receivedQty;
            const available = Math.max(0, newStock - (existing.reservedStock || 0));
            const alert = existing.lowStockAlert || 5;
            let stockStatus = 'in_stock';
            if (available === 0) stockStatus = 'out_of_stock';
            else if (available <= alert) stockStatus = 'low_stock';
            // costPrice now includes this item's share of transport cost (landed cost)
            await inventory.updateOne({ productId: item.productId }, { $set: { currentStock: newStock, availableStock: existing.availableStock + receivedQty, stockStatus, costPrice: landedCostPrice || existing.costPrice, updatedAt: new Date() } });
            await movements.insertOne({ productId: item.productId, type: 'in', quantity: receivedQty, reason: 'purchase_order', poLine: lineIdx, referenceId: id, balanceBefore, balanceAfter: newStock, note: `Received from PO ${po.poNumber}${transportCost > 0 ? ` — incl. ₹${perUnitTransportCost.toFixed(2)}/unit transport` : ''}${item.damageNotes ? ` — ${item.damageNotes}` : ''}`, createdAt: new Date() });
            await syncFrontendStatusIfAuto(inventory, item.productId, { ...existing, availableStock: existing.availableStock + receivedQty });
          } else {
            await inventory.insertOne({ productId: item.productId, sku: item.sku || '', currentStock: receivedQty, reservedStock: 0, availableStock: receivedQty, lowStockAlert: 10, costPrice: landedCostPrice, unit: 'pcs', trackInventory: true, stockStatus: 'in_stock', createdAt: new Date(), updatedAt: new Date() });
            await movements.insertOne({ productId: item.productId, type: 'in', quantity: receivedQty, reason: 'purchase_order', poLine: lineIdx, referenceId: id, balanceBefore: 0, balanceAfter: receivedQty, note: `First stock from PO ${po.poNumber}${transportCost > 0 ? ` — incl. ₹${perUnitTransportCost.toFixed(2)}/unit transport` : ''}`, createdAt: new Date() });
          }
        }

        // ── Log the transport cost itself as a separate cashflow expense ──
        // (paid to a transporter/courier, not the supplier — kept out of the
        // supplier ledger so the AP balance below stays accurate to the invoice)
        if (transportCost > 0 && !(await cashFlow.findOne({ referenceId: id, referenceType: 'po_transport' }))) {
          await cashFlow.insertOne({
            type: 'expense', category: 'transport_cost', amount: transportCost,
            paymentMode: transportPaymentMode || poPaymentMode || 'cash',
            description: `Transport/Freight — PO ${po.poNumber} — ${po.supplier?.name || 'Supplier'}${transportNotes ? ` — ${transportNotes}` : ''}`,
            referenceId: id, referenceType: 'po_transport',
            poNumber: po.poNumber, supplierName: po.supplier?.name || '',
            date: new Date(), createdAt: new Date(),
          });
        }

        const advanceAlreadyPaid = po.paidAmount || 0;
        const balanceDue = Math.max(0, totalReceivedValue - advanceAlreadyPaid);
        // If we overpaid (advance > received value), supplier owes us the difference
        const overpaidAmount = Math.max(0, advanceAlreadyPaid - totalReceivedValue);
        // ✅ NO cashflow entry here — money already left during advance_payment
        // Only create a cashflow entry if there is remaining balance due (paid on delivery)
        if (balanceDue > 0.01 && !(await cashFlow.findOne({ referenceId: id, referenceType: 'purchase_order' }))) {
          await cashFlow.insertOne({
            type: 'expense', category: 'inventory_asset', amount: balanceDue,
            paymentMode: poPaymentMode || 'cash',
            description: `Balance Payment on Delivery — PO ${po.poNumber} — ${po.supplier?.name || 'Supplier'} (${totalReceived}/${totalOrdered} units)`,
            referenceId: id, referenceType: 'purchase_order',
            poNumber: po.poNumber, supplierName: po.supplier?.name || '',
            date: new Date(), createdAt: new Date(),
          });
        }

        const shortageStatus = shortageItems.length > 0 ? 'has_shortage' : 'complete';
        await orders.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'received', receivedDate: new Date(), updatedAt: new Date(), receivedItems, shortageStatus, shortageItems: shortageItems.length > 0 ? shortageItems : [], shortageValue: totalShortageValue, shortageResolved: shortageItems.length === 0, paidAmount: advanceAlreadyPaid + balanceDue, dueAmount: 0, transportCost, transportCostSplitMethod: totalReceivingValue > 0 ? 'proportional_to_value' : 'equal' }, $unset: { receiveLockAt: '' } });

        // ✅ NO cashflow income for shortage — money hasn't come back yet
        // Shortage is tracked in supplier ledger as a credit note (debit on supplier)
        // When supplier resolves it (refund or goods), THEN cashflow is created

        // ── AP LEDGER: auto-entries when stock received ──
        {
          let resolvedSupplierId = po.supplierId || null;
          if (!resolvedSupplierId && po.supplier?.name) {
            const supplierDoc = await db.collection('suppliers').findOne({ name: po.supplier.name });
            if (supplierDoc) resolvedSupplierId = supplierDoc._id.toString();
          }
          if (resolvedSupplierId) {
            // Credit = full ordered value (what the supplier invoiced).
            // The shortage debit below claws back the missing portion.
            // Using only totalReceivedValue here would under-credit and cause
            // the net balance to show double the shortage amount owed.
            const invoicedAmount = po.totalAmount || (totalReceivedValue + totalShortageValue);
            const creditAlreadyThere = await ledgerCol.findOne({ referenceType: 'purchase_order', referenceId: id, entryType: 'credit' });
            if (!creditAlreadyThere) await ledgerCol.insertOne({
              partyType: 'supplier', partyId: resolvedSupplierId,
              partyName: po.supplier?.name || '',
              entryType: 'credit',
              amount: invoicedAmount,
              description: `Goods received — PO ${po.poNumber} (${totalReceived}/${totalOrdered} units)`,
              referenceType: 'purchase_order', referenceId: id,
              paymentMode: null, notes: '',
              date: new Date(), createdAt: new Date(),
            });

            // ── Shortage debit: supplier owes us for goods not delivered ──
            // This claws back the shortage portion from the invoice credit above,
            // so net = (full invoice) - (advance paid) - (shortage) = correct balance.
            if (totalShortageValue > 0 && !(await ledgerCol.findOne({ referenceType: 'po_shortage', referenceId: id, entryType: 'debit' }))) {
              await ledgerCol.insertOne({
                partyType: 'supplier', partyId: resolvedSupplierId,
                partyName: po.supplier?.name || '',
                entryType: 'debit',
                amount: totalShortageValue,
                description: `Shortage / goods not received — PO ${po.poNumber} (${shortageItems.map(i => `${i.productName}: ${i.shortageQty} short`).join(', ')})`,
                referenceType: 'po_shortage', referenceId: id,
                paymentMode: null, notes: '',
                date: new Date(), createdAt: new Date(),
              });
            }
          }
        }

        const transportNote = transportCost > 0 ? ` Transport cost of ₹${transportCost.toFixed(2)} split proportionally by item value across ${itemsReceivingStock.length} item(s) and added to landed cost.` : '';
        return res.status(200).json({ success: true, message: (shortageItems.length > 0 ? `Stock updated. ⚠️ Shortage of ₹${totalShortageValue.toFixed(2)} recorded against ${po.supplier?.name || 'supplier'}.` : 'Stock fully received and inventory updated.') + transportNote, shortageItems, totalShortageValue, transportCost });
        } catch (receiveErr) {
          // Let the user try again right away; lines already received are skipped on the retry.
          await orders.updateOne({ _id: new ObjectId(id) }, { $unset: { receiveLockAt: '' } });
          throw receiveErr;
        }
      }

      // ── Edit a received PO — corrects qty/cost and adjusts stock by diff ──
      if (action === 'edit_received') {
        if (po.status !== 'received') {
          return res.status(400).json({ error: 'Only received POs can be edited with edit_received' });
        }

        const { items } = req.body;
        if (!items || items.length === 0) {
          return res.status(400).json({ error: 'items are required' });
        }

        const oldItems = po.receivedItems || po.items || [];

        for (const newItem of items) {
          const oldItem = oldItems.find(i => i.productId === newItem.productId);
          const oldQty = Number(oldItem?.quantityReceived ?? oldItem?.quantity) || 0;
          const newQty = Number(newItem.quantityReceived ?? newItem.quantity) || 0;
          const diff = newQty - oldQty; // positive = more stock added, negative = stock removed

          if (diff === 0) continue;

          const existing = await inventory.findOne({ productId: newItem.productId });
          if (!existing) continue;

          const newStock = Math.max(0, existing.currentStock + diff);
          const available = Math.max(0, newStock - (existing.reservedStock || 0));
          const alert = existing.lowStockAlert || 5;

          let stockStatus = 'in_stock';
          if (available === 0) stockStatus = 'out_of_stock';
          else if (available <= alert) stockStatus = 'low_stock';

          await inventory.updateOne(
            { productId: newItem.productId },
            {
              $set: { currentStock: newStock, availableStock: available, stockStatus, updatedAt: new Date() },
              $push: {
                adjustmentLog: {
                  adjustment: diff,
                  reason: `PO Edit — ${po.poNumber} (qty corrected: ${oldQty} → ${newQty})`,
                  date: new Date(),
                  stockAfter: newStock,
                }
              }
            }
          );

          await movements.insertOne({
            productId: newItem.productId,
            type: diff > 0 ? 'in' : 'out',
            quantity: Math.abs(diff),
            reason: 'po_edit',
            referenceId: id,
            balanceBefore: existing.currentStock,
            balanceAfter: newStock,
            note: `PO ${po.poNumber} edited — qty corrected: ${oldQty} → ${newQty}`,
            createdAt: new Date(),
          });
          await syncFrontendStatusIfAuto(inventory, newItem.productId, { ...existing, availableStock: available });
        }

        // Save corrected items and recalculate totals on the PO
        const enrichedItems = items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          quantityReceived: Number(item.quantityReceived ?? item.quantity),
          costPrice: Number(item.costPrice),
          totalCost: Number(item.quantity) * Number(item.costPrice),
        }));
        const newTotal = enrichedItems.reduce((s, i) => s + i.totalCost, 0);

        await orders.updateOne(
          { _id: new ObjectId(id) },
          { $set: { receivedItems: enrichedItems, totalAmount: newTotal, updatedAt: new Date() } }
        );

        return res.status(200).json({ success: true, message: 'Received PO updated and stock corrected.' });
      }

      // ── Return to supplier (partial or full) ──
      if (action === 'return_to_supplier') {
        if (!['received', 'partially_returned'].includes(po.status)) {
          return res.status(400).json({ error: 'Only received POs can be returned' });
        }

        const { returnItems, returnReason = '', paymentMode = 'cash' } = req.body;
        // returnItems: [{ productId, productName, returnQty, costPrice }]

        if (!returnItems || returnItems.length === 0) {
          return res.status(400).json({ error: 'returnItems are required' });
        }

        let totalReturnValue = 0;

        for (const item of returnItems) {
          const returnQty = Number(item.returnQty) || 0;
          if (returnQty <= 0) continue;

          const existing = await inventory.findOne({ productId: item.productId });
          if (!existing) continue;

          const newStock = Math.max(0, existing.currentStock - returnQty);
          const available = Math.max(0, newStock - (existing.reservedStock || 0));
          const alert = existing.lowStockAlert || 5;
          const costPrice = Number(item.costPrice) || 0;
          totalReturnValue += returnQty * costPrice;

          let stockStatus = 'in_stock';
          if (available === 0) stockStatus = 'out_of_stock';
          else if (available <= alert) stockStatus = 'low_stock';

          await inventory.updateOne(
            { productId: item.productId },
            {
              $set: { currentStock: newStock, availableStock: available, stockStatus, updatedAt: new Date() },
              $push: {
                adjustmentLog: {
                  adjustment: -returnQty,
                  reason: `Return to supplier — ${po.poNumber}${returnReason ? `: ${returnReason}` : ''}`,
                  date: new Date(),
                  stockAfter: newStock,
                }
              }
            }
          );

          await movements.insertOne({
            productId: item.productId,
            type: 'out',
            quantity: returnQty,
            reason: 'supplier_return',
            referenceId: id,
            balanceBefore: existing.currentStock,
            balanceAfter: newStock,
            note: `Returned to supplier — PO ${po.poNumber}${returnReason ? ` — ${returnReason}` : ''}`,
            createdAt: new Date(),
          });
          await syncFrontendStatusIfAuto(inventory, item.productId, { ...existing, availableStock: available });
        }

        // Log refund as income in cashFlow
        await cashFlow.insertOne({
          type: 'income',
          category: 'supplier_return_refund',
          amount: totalReturnValue,
          paymentMode,
          description: `Return to supplier — PO ${po.poNumber} — ${po.supplier?.name || 'Supplier'}${returnReason ? ` — ${returnReason}` : ''}`,
          referenceId: id,
          referenceType: 'po_return',
          poNumber: po.poNumber,
          supplierName: po.supplier?.name || '',
          returnItems,
          date: new Date(),
          createdAt: new Date(),
        });

        // Determine if fully or partially returned
        const allReturned = (po.receivedItems || po.items || []).every(poItem => {
          const ret = returnItems.find(r => r.productId === poItem.productId);
          return ret && Number(ret.returnQty) >= Number(poItem.quantityReceived ?? poItem.quantity);
        });

        await orders.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: allReturned ? 'returned' : 'partially_returned',
              returnItems,
              returnReason,
              returnDate: new Date(),
              returnValue: totalReturnValue,
              updatedAt: new Date(),
            }
          }
        );

        return res.status(200).json({
          success: true,
          message: `${allReturned ? 'Full' : 'Partial'} return recorded. Stock deducted. Refund of ₹${totalReturnValue.toFixed(2)} logged.`,
          totalReturnValue,
          status: allReturned ? 'returned' : 'partially_returned',
        });
      }

      // ── Shortage Resolution ──
      if (action === 'resolve_shortage') {
        if (po.status !== 'received') return res.status(400).json({ error: 'PO must be received first' });
        if (!po.shortageItems?.length) return res.status(400).json({ error: 'No shortage to resolve' });
        const { resolveType, amount, paymentMode: rMode, resolvedItems, notes: rNotes } = req.body;

        if (resolveType === 'refund') {
          const refundAmt = Number(amount) || po.shortageValue || 0;
          await cashFlow.insertOne({ type: 'income', category: 'po_shortage_refund', amount: refundAmt, paymentMode: rMode || 'cash', description: `Shortage Refund — PO ${po.poNumber} — ${po.supplier?.name || 'Supplier'}${rNotes ? ` — ${rNotes}` : ''}`, referenceId: id, referenceType: 'po_resolution', poNumber: po.poNumber, supplierName: po.supplier?.name || '', date: new Date(), createdAt: new Date() });
          await cashFlow.updateMany({ referenceId: id, referenceType: 'po_shortage' }, { $set: { resolved: true, resolvedAt: new Date(), resolvedAmount: refundAmt } });

          // ── Ledger: credit entry to settle the shortage debit (supplier paid us back) ──
          let refundSupplierId = po.supplierId || null;
          if (!refundSupplierId && po.supplier?.name) {
            const supplierDoc = await db.collection('suppliers').findOne({ name: po.supplier.name });
            if (supplierDoc) refundSupplierId = supplierDoc._id.toString();
          }
          if (refundSupplierId) {
            await ledgerCol.insertOne({
              partyType: 'supplier', partyId: refundSupplierId,
              partyName: po.supplier?.name || '',
              entryType: 'credit',
              amount: refundAmt,
              description: `Shortage refund received — PO ${po.poNumber}${rNotes ? ` — ${rNotes}` : ''}`,
              referenceType: 'po_shortage_refund', referenceId: id,
              paymentMode: rMode || 'cash', notes: rNotes || '',
              date: new Date(), createdAt: new Date(),
            });
          }

          await orders.updateOne({ _id: new ObjectId(id) }, { $set: { shortageResolved: true, shortageResolvedAt: new Date(), shortageResolveType: 'refund', shortageRefundAmount: refundAmt, updatedAt: new Date() } });
          return res.status(200).json({ success: true, message: `Refund of ₹${refundAmt} recorded.` });
        }

        if (resolveType === 'goods') {
          const itemsToReceive = resolvedItems || po.shortageItems;
          for (const item of itemsToReceive) {
            const qty = Number(item.resolvedQty || item.shortageQty);
            if (qty <= 0) continue;
            const existing = await inventory.findOne({ productId: item.productId });
            if (existing) {
              const balanceBefore = existing.currentStock;
              const newStock = existing.currentStock + qty;
              const available = Math.max(0, newStock - (existing.reservedStock || 0));
              const alert = existing.lowStockAlert || 5;
              let stockStatus = 'in_stock';
              if (available === 0) stockStatus = 'out_of_stock';
              else if (available <= alert) stockStatus = 'low_stock';
              await inventory.updateOne({ productId: item.productId }, { $set: { currentStock: newStock, availableStock: existing.availableStock + qty, stockStatus, updatedAt: new Date() } });
              await movements.insertOne({ productId: item.productId, type: 'in', quantity: qty, reason: 'shortage_resolution', referenceId: id, balanceBefore, balanceAfter: newStock, note: `Shortage resolved — PO ${po.poNumber}`, createdAt: new Date() });
              await syncFrontendStatusIfAuto(inventory, item.productId, { ...existing, availableStock: existing.availableStock + qty });
            }
          }
          await cashFlow.updateMany({ referenceId: id, referenceType: 'po_shortage' }, { $set: { resolved: true, resolvedAt: new Date(), resolveType: 'goods' } });

          // ── Ledger: credit entry to settle the shortage debit (supplier delivered missing goods) ──
          const resolvedShortageValue = (resolvedItems || po.shortageItems).reduce((sum, item) => {
            const qty = Number(item.resolvedQty || item.shortageQty);
            return sum + qty * Number(item.costPrice || 0);
          }, 0);
          let goodsSupplierId = po.supplierId || null;
          if (!goodsSupplierId && po.supplier?.name) {
            const supplierDoc = await db.collection('suppliers').findOne({ name: po.supplier.name });
            if (supplierDoc) goodsSupplierId = supplierDoc._id.toString();
          }
          if (goodsSupplierId && resolvedShortageValue > 0) {
            await ledgerCol.insertOne({
              partyType: 'supplier', partyId: goodsSupplierId,
              partyName: po.supplier?.name || '',
              entryType: 'credit',
              amount: resolvedShortageValue,
              description: `Shortage resolved (goods delivered) — PO ${po.poNumber}`,
              referenceType: 'po_shortage_goods', referenceId: id,
              paymentMode: null, notes: '',
              date: new Date(), createdAt: new Date(),
            });
          }

          await orders.updateOne({ _id: new ObjectId(id) }, { $set: { shortageResolved: true, shortageResolvedAt: new Date(), shortageResolveType: 'goods', updatedAt: new Date() } });
          return res.status(200).json({ success: true, message: 'Missing goods received. Stock updated.' });
        }

        return res.status(400).json({ error: 'resolveType must be "goods" or "refund"' });
      }

      // ── Record payment ──
      if (action === 'pay') {
        const { amount, paymentMode: pmMode, notes: pmNotes, isAdvance } = req.body;
        const paid = Number(amount);
        const newPaid = po.paidAmount + paid;
        const newDue = Math.max(0, po.totalAmount - newPaid);

        await orders.updateOne(
          { _id: new ObjectId(id) },
          { $set: { paidAmount: newPaid, dueAmount: newDue, updatedAt: new Date() } }
        );

        {
          let resolvedSupplierId = po.supplierId || null;
          if (!resolvedSupplierId && po.supplier?.name) {
            const supplierDoc = await db.collection('suppliers').findOne({ name: po.supplier.name });
            if (supplierDoc) resolvedSupplierId = supplierDoc._id.toString();
          }
          if (resolvedSupplierId) {
            const ledgerResult = await ledgerCol.insertOne({
              partyType: 'supplier', partyId: resolvedSupplierId,
              partyName: po.supplier?.name || '',
              entryType: 'debit',
              amount: paid,
              description: isAdvance
                ? `Advance payment — PO ${po.poNumber}`
                : `Payment against PO ${po.poNumber}`,
              referenceType: isAdvance ? 'advance_payment' : 'payment',
              referenceId: id,
              paymentMode: pmMode || 'cash',
              notes: pmNotes || '',
              date: new Date(), createdAt: new Date(),
            });
            await cashFlow.insertOne({
              type: 'expense', category: 'supplier_payment',
              amount: paid,
              paymentMode: pmMode || 'cash',
              description: isAdvance
                ? `Advance to ${po.supplier?.name} — PO ${po.poNumber}`
                : `Payment to ${po.supplier?.name} — PO ${po.poNumber}`,
              referenceId: ledgerResult.insertedId.toString(),
              referenceType: 'ledger_payment',
              partyId: resolvedSupplierId,
              date: new Date(), createdAt: new Date(),
            });
          }
        }

        return res.status(200).json({ success: true, paidAmount: newPaid, dueAmount: newDue });
      }

      // ── Cancel PO ──
      if (action === 'cancel') {
        if (['received', 'returned', 'partially_returned'].includes(po.status)) {
          return res.status(400).json({ error: 'Cannot cancel a received or returned PO. Use return_to_supplier instead.' });
        }
        await cashFlow.deleteMany({ referenceId: id, referenceType: 'po_advance' });
        await orders.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'cancelled', updatedAt: new Date() } });
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // ─────────────────────────────────────────────
    // DELETE /api/purchase-orders
    // Draft POs: deleted immediately, no stock impact
    // Received POs: stock fully reversed, ledger + cashFlow cleaned up
    // ─────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const po = await orders.findOne({ _id: new ObjectId(id) });
      if (!po) return res.status(404).json({ error: 'Purchase order not found' });

      if (!['draft', 'received'].includes(po.status)) {
        return res.status(400).json({ error: 'Only draft or received POs can be deleted. For returned/partially returned POs, no deletion is allowed.' });
      }

      // ── Reverse stock if PO was received ──
      if (po.status === 'received') {
        const itemsToReverse = po.receivedItems || po.items || [];

        for (const item of itemsToReverse) {
          const qty = Number(item.quantityReceived ?? item.quantity) || 0;
          if (qty <= 0) continue;

          const existing = await inventory.findOne({ productId: item.productId });
          if (!existing) continue;

          const newStock = Math.max(0, existing.currentStock - qty);
          const available = Math.max(0, newStock - (existing.reservedStock || 0));
          const alert = existing.lowStockAlert || 5;

          let stockStatus = 'in_stock';
          if (available === 0) stockStatus = 'out_of_stock';
          else if (available <= alert) stockStatus = 'low_stock';

          await inventory.updateOne(
            { productId: item.productId },
            {
              $set: { currentStock: newStock, availableStock: available, stockStatus, updatedAt: new Date() },
              $push: {
                adjustmentLog: {
                  adjustment: -qty,
                  reason: `PO Deleted — ${po.poNumber}`,
                  date: new Date(),
                  stockAfter: newStock,
                }
              }
            }
          );

          await movements.insertOne({
            productId: item.productId,
            type: 'out',
            quantity: qty,
            reason: 'po_deleted',
            referenceId: id,
            balanceBefore: existing.currentStock,
            balanceAfter: newStock,
            note: `PO ${po.poNumber} deleted — stock reversed`,
            createdAt: new Date(),
          });
          await syncFrontendStatusIfAuto(inventory, item.productId, { ...existing, availableStock: available });
        }

        // Clean up all financial entries linked to this PO
        await cashFlow.deleteMany({ referenceId: id });
        await ledgerCol.deleteMany({ referenceId: id });
      }

      // Draft-only cleanup: remove any advance cashFlow entries
      if (po.status === 'draft') {
        await cashFlow.deleteMany({ referenceId: id, referenceType: 'po_advance' });
      }

      await orders.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true, message: `PO ${po.poNumber} deleted${po.status === 'received' ? ' and stock fully reversed' : ''}.` });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Purchase Orders API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
