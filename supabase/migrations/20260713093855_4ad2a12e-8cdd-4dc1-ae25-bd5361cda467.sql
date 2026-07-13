
REVOKE ALL ON FUNCTION public.recompute_item_stock(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_stock_mov_recompute() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_inv_item_opening() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deduct_inventory_on_production() FROM PUBLIC, anon, authenticated;
