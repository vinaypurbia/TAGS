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

    // ─────────────────────────────────────────────
    // GET /api/purchase-orders
    // ?id=xxx  → single PO
    // ?status=ordered → filter by status
    // ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const { id, status } = req.query;

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
        const receivedItems = req.body.receivedItems || po.items.map(i => ({ ...i, quantityReceived: i.quantity, damageNotes: '' }));
        const { paymentMode: poPaymentMode } = req.body;
        let totalOrdered = 0, totalReceived = 0, totalReceivedValue = 0, totalShortageValue = 0;
        const shortageItems = [];

        for (const item of receivedItems) {
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
          const existing = await inventory.findOne({ productId: item.productId });
          if (existing) {
            const balanceBefore = existing.currentStock;
            const newStock = existing.currentStock + receivedQty;
            const available = Math.max(0, newStock - (existing.reservedStock || 0));
            const alert = existing.lowStockAlert || 5;
            let stockStatus = 'in_stock';
            if (available === 0) stockStatus = 'out_of_stock';
            else if (available <= alert) stockStatus = 'low_stock';
            await inventory.updateOne({ productId: item.productId }, { $set: { currentStock: newStock, availableStock: existing.availableStock + receivedQty, stockStatus, costPrice: costP || existing.costPrice, updatedAt: new Date() } });
            await movements.insertOne({ productId: item.productId, type: 'in', quantity: receivedQty, reason: 'purchase_order', referenceId: id, balanceBefore, balanceAfter: newStock, note: `Received from PO ${po.poNumber}${item.damageNotes ? ` — ${item.damageNotes}` : ''}`, createdAt: new Date() });
          } else {
            await inventory.insertOne({ productId: item.productId, sku: item.sku || '', currentStock: receivedQty, reservedStock: 0, availableStock: receivedQty, lowStockAlert: 10, costPrice: costP, unit: 'pcs', trackInventory: true, stockStatus: 'in_stock', createdAt: new Date(), updatedAt: new Date() });
            await movements.insertOne({ productId: item.productId, type: 'in', quantity: receivedQty, reason: 'purchase_order', referenceId: id, balanceBefore: 0, balanceAfter: receivedQty, note: `First stock from PO ${po.poNumber}`, createdAt: new Date() });
          }
        }

        const advanceAlreadyPaid = po.paidAmount || 0;
        const balanceDue = Math.max(0, totalReceivedValue - advanceAlreadyPaid);
        // If we overpaid (advance > received value), supplier owes us the difference
        const overpaidAmount = Math.max(0, advanceAlreadyPaid - totalReceivedValue);
        // ✅ NO cashflow entry here — money already left during advance_payment
        // Only create a cashflow entry if there is remaining balance due (paid on delivery)
        if (balanceDue > 0.01) {
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
        await orders.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'received', receivedDate: new Date(), updatedAt: new Date(), receivedItems, shortageStatus, shortageItems: shortageItems.length > 0 ? shortageItems : [], shortageValue: totalShortageValue, shortageResolved: shortageItems.length === 0, paidAmount: advanceAlreadyPaid + balanceDue, dueAmount: 0 } });

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
            await ledgerCol.insertOne({
              partyType: 'supplier', partyId: resolvedSupplierId,
              partyName: po.supplier?.name || '',
              entryType: 'credit',
              amount: totalReceivedValue,
              description: `Goods received — PO ${po.poNumber} (${totalReceived}/${totalOrdered} units)`,
              referenceType: 'purchase_order', referenceId: id,
              paymentMode: null, notes: '',
              date: new Date(), createdAt: new Date(),
            });
            // ✅ Only one credit note for shortage — no separate overpayment entry
            // The short_delivery entry below covers the full amount claimable
            if (totalShortageValue > 0.01) {
              await ledgerCol.insertOne({
                partyType: 'supplier', partyId: resolvedSupplierId,
                partyName: po.supplier?.name || '',
                entryType: 'debit',
                amount: totalShortageValue,
                description: `Short delivery credit note — PO ${po.poNumber} (₹${totalShortageValue.toFixed(2)} claimable)`,
                referenceType: 'short_delivery', referenceId: id,
                paymentMode: null,
                notes: shortageItems.map(s => `${s.productName}: ordered ${s.orderedQty}, received ${s.receivedQty}`).join('; '),
                date: new Date(), createdAt: new Date(),
              });
            }
          }
        }

        return res.status(200).json({ success: true, message: shortageItems.length > 0 ? `Stock updated. ⚠️ Shortage of ₹${totalShortageValue.toFixed(2)} recorded against ${po.supplier?.name || 'supplier'}.` : 'Stock fully received and inventory updated.', shortageItems, totalShortageValue });
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
            }
          }
          await cashFlow.updateMany({ referenceId: id, referenceType: 'po_shortage' }, { $set: { resolved: true, resolvedAt: new Date(), resolveType: 'goods' } });
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
