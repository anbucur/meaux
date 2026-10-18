-- =====================================================================
--  MEAUX CMS — MEDIA ITEMS TABLE & SEED
--  Run this in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================

create table if not exists public.media_items (
  id          text primary key default gen_random_uuid()::text,
  filename    text not null,
  title       text,
  caption     text,
  url         text,          -- Absolute or relative HTTP link
  blob_data   text,          -- Optional Base64 data URL / blob for manual direct uploads
  source      text not null default 'catalog', -- 'catalog', 'upload', 'link'
  mime_type   text default 'image/jpeg',
  created_at  timestamptz not null default now(),
  created_by  text
);

-- Row Level Security
alter table public.media_items enable row level security;

drop policy if exists "media_items: public read" on public.media_items;
create policy "media_items: public read" on public.media_items for select to anon, authenticated using (true);

drop policy if exists "media_items: admin insert" on public.media_items;
create policy "media_items: admin insert" on public.media_items for insert to authenticated with check (public.is_admin());

drop policy if exists "media_items: admin update" on public.media_items;
create policy "media_items: admin update" on public.media_items for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "media_items: admin delete" on public.media_items;
create policy "media_items: admin delete" on public.media_items for delete to authenticated using (public.is_admin());

grant select on public.media_items to anon, authenticated;
grant insert, update, delete on public.media_items to authenticated;

-- Seed initial portfolio media items
insert into public.media_items (id, filename, title, caption, url, source, created_by)
values
  ('media_DW9lQW_DUjv', 'DW9lQW_DUjv.jpg', 'anoukromeeschmitz seduca', '@anoukromeeschmitz seduca 📸📸', 'https://alexnbucur.space/instagram/meauxsvision/images/DW9lQW_DUjv.jpg', 'catalog', 'seed'),
  ('media_DT2XryvjWCB', 'DT2XryvjWCB.jpg', 'Daan series daan___sanders 🩶🤍', 'Daan series @daan___sanders 🩶🤍📸', 'https://alexnbucur.space/instagram/meauxsvision/images/DT2XryvjWCB.jpg', 'catalog', 'seed'),
  ('media_DTpuNcKjeUN', 'DTpuNcKjeUN.jpg', 'UNIDENTIFIED anoukromeeschmitz', 'UNIDENTIFIED @anoukromeeschmitz 
Styling/photography by me', 'https://alexnbucur.space/instagram/meauxsvision/images/DTpuNcKjeUN.jpg', 'catalog', 'seed'),
  ('media_DTPohhYjdPI', 'DTPohhYjdPI.jpg', 'Powerwoman shoot with fatima_essahsah', 'Powerwoman shoot with @fatima_essahsah', 'https://alexnbucur.space/instagram/meauxsvision/images/DTPohhYjdPI.jpg', 'catalog', 'seed'),
  ('media_DRKpcsjDSo2', 'DRKpcsjDSo2.jpg', 'anoukromeeschmitz', '@anoukromeeschmitz', 'https://alexnbucur.space/instagram/meauxsvision/images/DRKpcsjDSo2.jpg', 'catalog', 'seed'),
  ('media_DObqkm2jfxe', 'DObqkm2jfxe.jpg', 'shari.louise for wissalaziz', '@shari.louise for @wissalaziz 
Pic and styling by @meauxsvision', 'https://alexnbucur.space/instagram/meauxsvision/images/DObqkm2jfxe.jpg', 'catalog', 'seed'),
  ('media_DL-e-W1N1w-', 'DL-e-W1N1w-.jpg', 'FETUS', 'FETUS 

@anoukromeeschmitz', 'https://alexnbucur.space/instagram/meauxsvision/images/DL-e-W1N1w-.jpg', 'catalog', 'seed'),
  ('media_DH8FEYCNA1U', 'DH8FEYCNA1U.jpg', '🦋🦋 nandin_erdene_enn', '🦋🦋 @nandin_erdene_enn 

Butterfly: @anoukromeeschmitz', 'https://alexnbucur.space/instagram/meauxsvision/images/DH8FEYCNA1U.jpg', 'catalog', 'seed'),
  ('media_DGgGMqcv5G5', 'DGgGMqcv5G5.jpg', 'daan___sanders', '@daan___sanders', 'https://alexnbucur.space/instagram/meauxsvision/images/DGgGMqcv5G5.jpg', 'catalog', 'seed'),
  ('media_DF8iodrtbss', 'DF8iodrtbss.jpg', '�️�️', '🕷️🕸️

MODEL : @daan___sanders 
STYLING/PHOTOGRAPHY/ART DIRECTION: me🖤

#photography', 'https://alexnbucur.space/instagram/meauxsvision/images/DF8iodrtbss.jpg', 'catalog', 'seed'),
  ('media_DFqKHPlNV1t', 'DFqKHPlNV1t.jpg', 'Surrealism', 'Surrealism 

📸 @meauxsvision @meeaaux', 'https://alexnbucur.space/instagram/meauxsvision/images/DFqKHPlNV1t.jpg', 'catalog', 'seed'),
  ('media_DEXuQ0gNbcp', 'DEXuQ0gNbcp.jpg', 'TENEBRIS PAPILIONEM', 'TENEBRIS PAPILIONEM 

@anoukromeeschmitz', 'https://alexnbucur.space/instagram/meauxsvision/images/DEXuQ0gNbcp.jpg', 'catalog', 'seed'),
  ('media_DALs3rUt3RC', 'DALs3rUt3RC.jpg', 'VIGIL - (the watcher)', 'VIGIL - (the watcher) 

PRINCEPS TENEBRIS 

Creative direction/styling/photography by me', 'https://alexnbucur.space/instagram/meauxsvision/images/DALs3rUt3RC.jpg', 'catalog', 'seed'),
  ('media_C-vbQzBtHy8', 'C-vbQzBtHy8.jpg', 'COSMICA MULLIER - (Cosmic Woman)', 'COSMICA MULLIER - (Cosmic Woman) 

PRINCEPS TENEBRIS 

Creative direction/styling/photography by me', 'https://alexnbucur.space/instagram/meauxsvision/images/C-vbQzBtHy8.jpg', 'catalog', 'seed'),
  ('media_C-VSlnaNa_c', 'C-VSlnaNa_c.jpg', 'For rouhi.co', 'For @rouhi.co 📸', 'https://alexnbucur.space/instagram/meauxsvision/images/C-VSlnaNa_c.jpg', 'catalog', 'seed'),
  ('media_C8IHD9Gt_GO', 'C8IHD9Gt_GO.jpg', 'For modestartofficial', 'For @modestartofficial 
Pics by me', 'https://alexnbucur.space/instagram/meauxsvision/images/C8IHD9Gt_GO.jpg', 'catalog', 'seed'),
  ('media_C7zMIi5tSg4', 'C7zMIi5tSg4.jpg', 'Shot & styled anissabchiri in Dubai', 'Shot & styled @anissabchiri in Dubai', 'https://alexnbucur.space/instagram/meauxsvision/images/C7zMIi5tSg4.jpg', 'catalog', 'seed'),
  ('media_C7b4UpfNrcR', 'C7b4UpfNrcR.jpg', 'Shot & styled the beautiful larissabruin in #milos wearing thriftsand_threads', 'Shot & styled the beautiful @larissabruin in #milos wearing @thriftsand_threads', 'https://alexnbucur.space/instagram/meauxsvision/images/C7b4UpfNrcR.jpg', 'catalog', 'seed'),
  ('media_C7ZtLU_NaDC', 'C7ZtLU_NaDC.jpg', 'Still my absolute favourite work lbsabri', 'Still my absolute favourite work @lbsabri', 'https://alexnbucur.space/instagram/meauxsvision/images/C7ZtLU_NaDC.jpg', 'catalog', 'seed'),
  ('media_C5gNw4tNBbO', 'C5gNw4tNBbO.jpg', 'Pics for babushamsterdam sihamazouzofficial', 'Pics for @babushamsterdam @sihamazouzofficial', 'https://alexnbucur.space/instagram/meauxsvision/images/C5gNw4tNBbO.jpg', 'catalog', 'seed'),
  ('media_C48XQvEtjAX', 'C48XQvEtjAX.jpg', 'Shots by me for lallamoulati.nl', 'Shots by me for @lallamoulati.nl', 'https://alexnbucur.space/instagram/meauxsvision/images/C48XQvEtjAX.jpg', 'catalog', 'seed'),
  ('media_C4a1FCkNysZ', 'C4a1FCkNysZ.jpg', 'Gloom⚪️', 'Gloom⚪️ 📸📸', 'https://alexnbucur.space/instagram/meauxsvision/images/C4a1FCkNysZ.jpg', 'catalog', 'seed'),
  ('media_C4Ao4jWtDvY', 'C4Ao4jWtDvY.jpg', 'For babushamsterdam beautiful dina_aitbibi', 'For @babushamsterdam beautiful @dina_aitbibi 📸📸', 'https://alexnbucur.space/instagram/meauxsvision/images/C4Ao4jWtDvY.jpg', 'catalog', 'seed'),
  ('media_C3Ky93mNNFw', 'C3Ky93mNNFw.jpg', 'Isabelle’s eyes❤️ shot by me', 'Isabelle’s eyes❤️ shot by me📸', 'https://alexnbucur.space/instagram/meauxsvision/images/C3Ky93mNNFw.jpg', 'catalog', 'seed'),
  ('media_C3FTJ2LtZZl', 'C3FTJ2LtZZl.jpg', 'Atelier Work 25', '📸', 'https://alexnbucur.space/instagram/meauxsvision/images/C3FTJ2LtZZl.jpg', 'catalog', 'seed'),
  ('media_C0RNWyrt7sx', 'C0RNWyrt7sx.jpg', 'Full shooting trip to Lanzarote shot by me for larissabruin', 'Full shooting trip to Lanzarote shot by me for @larissabruin', 'https://alexnbucur.space/instagram/meauxsvision/images/C0RNWyrt7sx.jpg', 'catalog', 'seed'),
  ('media_CzeoA8tNsj4', 'CzeoA8tNsj4.jpg', 'ISABEL isabelblankenzee shot and directed by me', 'ISABEL @isabelblankenzee shot and directed by me', 'https://alexnbucur.space/instagram/meauxsvision/images/CzeoA8tNsj4.jpg', 'catalog', 'seed'),
  ('media_CzZIYAtNU9a', 'CzZIYAtNU9a.jpg', 'loubotomized', '@loubotomized 
pretty gyal shot by me', 'https://alexnbucur.space/instagram/meauxsvision/images/CzZIYAtNU9a.jpg', 'catalog', 'seed'),
  ('media_Cxz0P5ytark', 'Cxz0P5ytark.jpg', 'gowtubywissalaziz artist wissal in vanderwiltamsterdam', '@gowtubywissalaziz artist wissal in @vanderwiltamsterdam 📸📸', 'https://alexnbucur.space/instagram/meauxsvision/images/Cxz0P5ytark.jpg', 'catalog', 'seed'),
  ('media_CxzzqKdto53', 'CxzzqKdto53.jpg', 'khaoulaboumeshouli', '@khaoulaboumeshouli 📸📸', 'https://alexnbucur.space/instagram/meauxsvision/images/CxzzqKdto53.jpg', 'catalog', 'seed'),
  ('media_CxlF0ZWtP8T', 'CxlF0ZWtP8T.jpg', 'Yesterday’s wedding for lizasophie omarwaseq beautiful couple', 'Yesterday’s wedding for @lizasophie @omarwaseq beautiful couple

Shot by moi', 'https://alexnbucur.space/instagram/meauxsvision/images/CxlF0ZWtP8T.jpg', 'catalog', 'seed'),
  ('media_CvS0lEnNrMr', 'CvS0lEnNrMr.jpg', 'Fun snapping some shots for Zaheera', 'Fun snapping some shots for Zaheera', 'https://alexnbucur.space/instagram/meauxsvision/images/CvS0lEnNrMr.jpg', 'catalog', 'seed'),
  ('media_Cr8e19bN3mq', 'Cr8e19bN3mq.jpg', 'Shot mel.dlgn in jeanpaulgaultier', 'Shot @mel.dlgn in @jeanpaulgaultier', 'https://alexnbucur.space/instagram/meauxsvision/images/Cr8e19bN3mq.jpg', 'catalog', 'seed'),
  ('media_CqOSc5kN3gA', 'CqOSc5kN3gA.jpg', 'mel.dlgn for vanderwiltamsterdam', '@mel.dlgn for @vanderwiltamsterdam 
 Pics and creative direction by MOI', 'https://alexnbucur.space/instagram/meauxsvision/images/CqOSc5kN3gA.jpg', 'catalog', 'seed'),
  ('media_CoITMmjtXDQ', 'CoITMmjtXDQ.jpg', 'A gazelle in jacquemus mysahairclinic', 'A gazelle in jacquemus @mysahairclinic 
Shot & styled by me', 'https://alexnbucur.space/instagram/meauxsvision/images/CoITMmjtXDQ.jpg', 'catalog', 'seed'),
  ('media_CnmdLLNtzm_', 'CnmdLLNtzm_.jpg', 'Atelier Work 36', '📸📸', 'https://alexnbucur.space/instagram/meauxsvision/images/CnmdLLNtzm_.jpg', 'catalog', 'seed'),
  ('media_CneOhP-t126', 'CneOhP-t126.jpg', 'Make up shots for ha.azmani with beautiful model fleurdediver', 'Make up shots for @ha.azmani with beautiful model @fleurdediver', 'https://alexnbucur.space/instagram/meauxsvision/images/CneOhP-t126.jpg', 'catalog', 'seed'),
  ('media_CnClh0aN_b4', 'CnClh0aN_b4.jpg', 'Oum in paris memaori', 'Oum in paris @memaori 📸', 'https://alexnbucur.space/instagram/meauxsvision/images/CnClh0aN_b4.jpg', 'catalog', 'seed'),
  ('media_CmUFVnZNhJW', 'CmUFVnZNhJW.jpg', 'Throwback to when I made some shots for sihamazouzofficial', 'Throwback to when I made some shots for @sihamazouzofficial', 'https://alexnbucur.space/instagram/meauxsvision/images/CmUFVnZNhJW.jpg', 'catalog', 'seed'),
  ('media_CmUE_30NMYe', 'CmUE_30NMYe.jpg', 'Sunset shots are my fave', 'Sunset shots are my fave', 'https://alexnbucur.space/instagram/meauxsvision/images/CmUE_30NMYe.jpg', 'catalog', 'seed'),
  ('media_Clt2SNGN1YE', 'Clt2SNGN1YE.jpg', 'Back when we were in spain for ibtlssam selfmade clothing! Pic by me', 'Back when we were in spain for @ibtlssam selfmade clothing! Pic by me', 'https://alexnbucur.space/instagram/meauxsvision/images/Clt2SNGN1YE.jpg', 'catalog', 'seed'),
  ('media_Ck6Roc1tJYn', 'Ck6Roc1tJYn.jpg', 'Styling and pic by me for this beautiful being mel.dlgn', 'Styling and pic by me for this beautiful being @mel.dlgn', 'https://alexnbucur.space/instagram/meauxsvision/images/Ck6Roc1tJYn.jpg', 'catalog', 'seed'),
  ('media_CjanyD1Nsz4', 'CjanyD1Nsz4.jpg', 'Atelier Work 43', '📸📸', 'https://alexnbucur.space/instagram/meauxsvision/images/CjanyD1Nsz4.jpg', 'catalog', 'seed'),
  ('media_CjKj4H5tdNK', 'CjKj4H5tdNK.jpg', 'TO HAVE AND TO HOLD, THEY DO.', 'TO HAVE AND TO HOLD, THEY DO.
Had lots of fun shooting this gorgeous Armenian/italian couple 🤍🖤', 'https://alexnbucur.space/instagram/meauxsvision/images/CjKj4H5tdNK.jpg', 'catalog', 'seed'),
  ('media_Ciw_6rINvBg', 'Ciw_6rINvBg.jpg', 'My fave shots taken by me for zey.lina_ #photography', 'My fave shots taken by me for @zey.lina_ #photography', 'https://alexnbucur.space/instagram/meauxsvision/images/Ciw_6rINvBg.jpg', 'catalog', 'seed'),
  ('media_CgZWrHYtSBE', 'CgZWrHYtSBE.jpg', 'IB•', 'IB• 📸📸', 'https://alexnbucur.space/instagram/meauxsvision/images/CgZWrHYtSBE.jpg', 'catalog', 'seed'),
  ('media_CgP6UOHNggC', 'CgP6UOHNggC.jpg', 'the beautiful najbnr', '📸 the beautiful @najbnr', 'https://alexnbucur.space/instagram/meauxsvision/images/CgP6UOHNggC.jpg', 'catalog', 'seed'),
  ('media_Cfe1b09toZC', 'Cfe1b09toZC.jpg', 'Shot my caraMel mel.dlgn', 'Shot my caraMel @mel.dlgn', 'https://alexnbucur.space/instagram/meauxsvision/images/Cfe1b09toZC.jpg', 'catalog', 'seed'),
  ('media_CfY3m5vNidV', 'CfY3m5vNidV.jpg', '‘FLUL’ bromtji ❤️ by me', '‘FLUL’ @bromtji ❤️ 📸by me', 'https://alexnbucur.space/instagram/meauxsvision/images/CfY3m5vNidV.jpg', 'catalog', 'seed'),
  ('media_CdVsxkntawa', 'CdVsxkntawa.jpg', 'Shot romydfonseca for fendi versace', 'Shot @romydfonseca for @fendi @versace', 'https://alexnbucur.space/instagram/meauxsvision/images/CdVsxkntawa.jpg', 'catalog', 'seed'),
  ('media_CcTqk0yom1b', 'CcTqk0yom1b.jpg', 'Another one, shot khaoulaboumeshouli for joshvhq', 'Another one, shot @khaoulaboumeshouli for @joshvhq', 'https://alexnbucur.space/instagram/meauxsvision/images/CcTqk0yom1b.jpg', 'catalog', 'seed'),
  ('media_CcRJMWdtAeS', 'CcRJMWdtAeS.jpg', 'mel.dlgn', '@mel.dlgn', 'https://alexnbucur.space/instagram/meauxsvision/images/CcRJMWdtAeS.jpg', 'catalog', 'seed'),
  ('media_CcRGa1DN6AL', 'CcRGa1DN6AL.jpg', 'Shot khaoulaboumeshouli for joshvhq', 'Shot @khaoulaboumeshouli for @joshvhq', 'https://alexnbucur.space/instagram/meauxsvision/images/CcRGa1DN6AL.jpg', 'catalog', 'seed'),
  ('media_CcRGFEht-8K', 'CcRGFEht-8K.jpg', 'khaoulaboumeshouli', '@khaoulaboumeshouli', 'https://alexnbucur.space/instagram/meauxsvision/images/CcRGFEht-8K.jpg', 'catalog', 'seed'),
  ('media_CcRFg65tlmX', 'CcRFg65tlmX.jpg', 'inez.atili', '@inez.atili', 'https://alexnbucur.space/instagram/meauxsvision/images/CcRFg65tlmX.jpg', 'catalog', 'seed'),
  ('media_CcRFZXGNk3G', 'CcRFZXGNk3G.jpg', 'najbnr', '@najbnr', 'https://alexnbucur.space/instagram/meauxsvision/images/CcRFZXGNk3G.jpg', 'catalog', 'seed'),
  ('media_CcRFU0xNlvu', 'CcRFU0xNlvu.jpg', 'lbsabri', '@lbsabri', 'https://alexnbucur.space/instagram/meauxsvision/images/CcRFU0xNlvu.jpg', 'catalog', 'seed'),
  ('media_CcDIrpvtJA6', 'CcDIrpvtJA6.jpg', 'SABRI. lbsabri', 'SABRI. @lbsabri', 'https://alexnbucur.space/instagram/meauxsvision/images/CcDIrpvtJA6.jpg', 'catalog', 'seed'),
  ('media_CblHULWsvwV', 'CblHULWsvwV.jpg', 'Bromtji', '📸📸📸 Bromtji', 'https://alexnbucur.space/instagram/meauxsvision/images/CblHULWsvwV.jpg', 'catalog', 'seed'),
  ('media_CbaXNFuMYHG', 'CbaXNFuMYHG.jpg', 'For shebridalhouse #photography', 'For @shebridalhouse #photography', 'https://alexnbucur.space/instagram/meauxsvision/images/CbaXNFuMYHG.jpg', 'catalog', 'seed'),
  ('media_CbI4R9FMcTQ', 'CbI4R9FMcTQ.jpg', 'Shot khaoulaboumeshouli for guccibeauty', 'Shot @khaoulaboumeshouli for @guccibeauty', 'https://alexnbucur.space/instagram/meauxsvision/images/CbI4R9FMcTQ.jpg', 'catalog', 'seed')
on conflict (id) do update
  set title = excluded.title,
      caption = excluded.caption,
      url = excluded.url;
