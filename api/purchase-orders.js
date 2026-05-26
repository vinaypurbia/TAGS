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

      // Calculate totals
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
    //   "update"   → edit PO details (only if draft)
    //   "order"    → mark as ordered (draft → ordered)
    //   "receive"  → mark as received → AUTO adds stock to inventory
    //   "pay"      → record payment
    //   "cancel"   → cancel PO
    // ─────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { id, action } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const po = await orders.findOne({ _id: new ObjectId(id) });
      if (!po) return res.status(404).json({ error: 'Purchase order not found' });

      // ── Edit draft or ordered PO ──
      if (action === 'update' || !action) {
        if (!['draft', 'ordered'].includes(po.status)) {
          return res.status(400).json({ error: 'Only draft or ordered POs can be edited' });
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
        await cashFlow.insertOne({
          type: 'expense', category: 'advance_payment', amount: paid,
          paymentMode: pmMode || 'cash',
          description: `Advance Payment — PO ${po.poNumber} — ${po.supplier?.name || 'Supplier'}${pmNotes ? ` — ${pmNotes}` : ''}`,
          referenceId: id, referenceType: 'po_advance',
          supplierName: po.supplier?.name || '', poNumber: po.poNumber,
          date: new Date(), createdAt: new Date(),
        });
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
            await inventory.updateOne({ productId: item.productId }, { $set: { currentStock: newStock, availableStock: existing.availableStock + receivedQty, costPrice: costP || existing.costPrice, updatedAt: new Date() } });
            await movements.insertOne({ productId: item.productId, type: 'in', quantity: receivedQty, reason: 'purchase_order', referenceId: id, balanceBefore, balanceAfter: newStock, note: `Received from PO ${po.poNumber}${item.damageNotes ? ` — ${item.damageNotes}` : ''}`, createdAt: new Date() });
          } else {
            await inventory.insertOne({ productId: item.productId, sku: item.sku || '', currentStock: receivedQty, reservedStock: 0, availableStock: receivedQty, lowStockAlert: 10, costPrice: costP, unit: 'pcs', trackInventory: true, createdAt: new Date(), updatedAt: new Date() });
            await movements.insertOne({ productId: item.productId, type: 'in', quantity: receivedQty, reason: 'purchase_order', referenceId: id, balanceBefore: 0, balanceAfter: receivedQty, note: `First stock from PO ${po.poNumber}`, createdAt: new Date() });
          }
        }

        const advanceAlreadyPaid = po.paidAmount || 0;
        const balanceDue = Math.max(0, totalReceivedValue - advanceAlreadyPaid);
        await cashFlow.insertOne({
          type: 'expense', category: 'inventory_asset', amount: totalReceivedValue,
          paymentMode: poPaymentMode || 'cash',
          description: `Stock Received — PO ${po.poNumber} — ${po.supplier?.name || 'Supplier'} (${totalReceived}/${totalOrdered} units)`,
          referenceId: id, referenceType: 'purchase_order',
          poNumber: po.poNumber, supplierName: po.supplier?.name || '',
          advancePaid: advanceAlreadyPaid, balancePaid: balanceDue,
          date: new Date(), createdAt: new Date(),
        });

        const shortageStatus = shortageItems.length > 0 ? 'has_shortage' : 'complete';
        await orders.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'received', receivedDate: new Date(), updatedAt: new Date(), receivedItems, shortageStatus, shortageItems: shortageItems.length > 0 ? shortageItems : [], shortageValue: totalShortageValue, shortageResolved: shortageItems.length === 0, paidAmount: advanceAlreadyPaid + balanceDue, dueAmount: 0 } });

        if (shortageItems.length > 0) {
          await cashFlow.insertOne({
            type: 'income', category: 'po_shortage_receivable', amount: totalShortageValue,
            description: `Shortage / Damage — PO ${po.poNumber} — ${po.supplier?.name || 'Supplier'} — ${shortageItems.map(s => `${s.productName}: ${s.shortageQty} missing`).join(', ')}`,
            referenceId: id, referenceType: 'po_shortage',
            poNumber: po.poNumber, supplierName: po.supplier?.name || '',
            shortageItems, resolved: false, date: new Date(), createdAt: new Date(),
          });
        }

        // ── AP LEDGER: auto-entries when stock received ─────────────────────
        {
          let resolvedSupplierId = po.supplierId || null;
          if (!resolvedSupplierId && po.supplier?.name) {
            const supplierDoc = await db.collection('suppliers').findOne({ name: po.supplier.name });
            if (supplierDoc) resolvedSupplierId = supplierDoc._id.toString();
          }
          if (resolvedSupplierId) {
            // CREDIT: goods received — supplier is owed this amount
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
            // DEBIT: shortage — supplier owes us the shortfall value
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

      // ── Supplier Resolution ──
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
              await inventory.updateOne({ productId: item.productId }, { $set: { currentStock: newStock, availableStock: existing.availableStock + qty, updatedAt: new Date() } });
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

        // ── AP LEDGER: DEBIT — we paid the supplier ──────────────────────────
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
            // Also post to cashFlow for cash position tracking
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
        if (po.status === 'received') {
          return res.status(400).json({ error: 'Cannot cancel a received PO' });
        }
        await cashFlow.deleteMany({ referenceId: id, referenceType: 'po_advance' });
        await orders.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'cancelled', updatedAt: new Date() } });
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // ─────────────────────────────────────────────
    // DELETE /api/purchase-orders
    // Only draft POs can be deleted
    // ─────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const po = await orders.findOne({ _id: new ObjectId(id) });
      if (!po) return res.status(404).json({ error: 'Purchase order not found' });
      if (po.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft POs can be deleted' });
      }

      // Cascade: also remove any cashFlow entries linked to this PO
      await cashFlow.deleteMany({ referenceId: id, referenceType: 'purchase_order' });
      await orders.deleteOne({ _id: new ObjectId(id) });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Purchase Orders API error:', error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
