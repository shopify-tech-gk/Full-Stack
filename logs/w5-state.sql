-- W5 verification helper (local only, not committed): stock, reservations, orders, payments.
SELECT 'STOCK' AS k, s.sku_code, l.available, l.reserved
FROM catalog.sku s JOIN inventory.stock_level l ON l.sku_id = s.id::text AND l.deleted_at IS NULL
WHERE s.sku_code IN ('DEV-CELLO-PURO-CLASSIC-1000ML','DEV-MILTON-AQUA-FRIDGE-BOTTLE-1000ML','DEV-BOROSIL-COPPER-BOTTLE-950ML','DEV-CELLO-DURO-FLASK-500ML','DEV-CELLO-SWIFT-STEEL-BOTTLE-750ML')
ORDER BY s.sku_code;
SELECT 'ORDER' AS k, o.order_number, o.status, o.grand_total, o.created_at
FROM orders."order" o ORDER BY o.created_at DESC LIMIT 3;
SELECT 'PAY' AS k, p.razorpay_order_id, p.status, p.amount, p.razorpay_payment_id
FROM payments.payment p ORDER BY p.created_at DESC LIMIT 3;
