const { Wallet, Transaction } = require('../models/common');
const { DirectPayment, PayoutB2C } = require('../integrations/santimpay');

exports.topup = async (req, res) => {
  try {
    const { amount, paymentMethod = 'santimpay', phoneNumber, reason = 'Wallet Topup' } = req.body || {};
    if (!amount || amount <= 0) return res.status(400).json({ message: 'amount must be > 0' });
    if (!phoneNumber) return res.status(400).json({ message: 'phoneNumber is required' });

    const userId = String(req.user.id);
    const role = req.user.type;

    let wallet = await Wallet.findOne({ userId, role });
    if (!wallet) wallet = await Wallet.create({ userId, role, balance: 0 });

    const tx = await Transaction.create({
      txnId: undefined,
      refId: undefined,
      userId,
      role,
      amount,
      type: 'credit',
      method: 'santimpay',
      status: 'pending',
      metadata: { reason }
    });

    const notifyUrl = process.env.SANTIMPAY_NOTIFY_URL || `${process.env.BASE_URL || 'https://example.com'}/v1/wallet/webhook`;
    const response = await DirectPayment(String(tx._id), amount, reason, notifyUrl, phoneNumber, paymentMethod);

    // Store gateway response minimal data
    await Transaction.findByIdAndUpdate(tx._id, { metadata: { ...tx.metadata, gatewayResponse: response } });

    return res.status(202).json({ message: 'Topup initiated', transactionId: String(tx._id) });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.webhook = async (req, res) => {
  try {
    // Expect SantimPay to call with fields including ID, Status, Commission, TotalAmount, Msisdn, TxnId, RefId
    const body = req.body || {};
    const id = body.ID || body.id;
    if (!id) return res.status(400).json({ message: 'Invalid webhook payload' });

    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });

    const status = (body.Status || body.status || '').toString().toLowerCase();
    const normalizedStatus = status.includes('success') ? 'success' : status.includes('fail') ? 'failed' : 'pending';

    tx.txnId = body.TxnId || body.txnId || tx.txnId;
    tx.refId = body.RefId || body.refId || tx.refId;
    tx.status = normalizedStatus;
    tx.commission = body.Commission != null ? Number(body.Commission) : tx.commission;
    tx.totalAmount = body.TotalAmount != null ? Number(body.TotalAmount) : tx.totalAmount;
    tx.msisdn = body.Msisdn || body.msisdn || tx.msisdn;
    tx.metadata = { ...tx.metadata, webhook: body };
    await tx.save();

    if (normalizedStatus === 'success') {
      await Wallet.updateOne({ userId: tx.userId, role: tx.role }, { $inc: { balance: tx.amount } }, { upsert: true });
    }

    return res.json({ ok: true, status: normalizedStatus });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.transactions = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const rows = await Transaction.find({ userId: String(userId) }).sort({ createdAt: -1 }).lean();
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.withdraw = async (req, res) => {
  try {
    const { amount, destination, method = 'santimpay' } = req.body || {};
    if (!amount || amount <= 0) return res.status(400).json({ message: 'amount must be > 0' });

    const userId = String(req.user.id);
    const role = 'driver';
    if (req.user.type !== 'driver') return res.status(403).json({ message: 'Only drivers can withdraw' });

    const wallet = await Wallet.findOne({ userId, role });
    if (!wallet || wallet.balance < amount) return res.status(400).json({ message: 'Insufficient balance' });

    const tx = await Transaction.create({
      userId,
      role,
      amount,
      type: 'debit',
      method,
      status: 'pending',
      metadata: { destination }
    });

    const notifyUrl = process.env.SANTIMPAY_PAYOUT_NOTIFY_URL || `${process.env.BASE_URL || 'https://example.com'}/v1/wallet/webhook`;
    try {
      const response = await PayoutB2C(String(tx._id), amount, destination, notifyUrl, method);
      await Transaction.findByIdAndUpdate(tx._id, { metadata: { ...tx.metadata, gatewayResponse: response } });
      return res.status(202).json({ message: 'Withdrawal initiated', transactionId: String(tx._id) });
    } catch (err) {
      await Transaction.findByIdAndUpdate(tx._id, { status: 'failed', metadata: { ...tx.metadata, error: err.message } });
      return res.status(502).json({ message: `Payout failed: ${err.message}` });
    }
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

