-- =====================================================
-- MIGRACIÓN: 00021_cotizador_tasas_seed.sql
-- CRM Multi-tenant para Agencias de Seguros
-- Seed de tasas calibradas con datos reales del mercado
-- Versión: 2.0 — Marzo 2026
--
-- FACTORES POR COMPAÑÍA (tasa_compañía = tasa_AXA × factor):
--   AXA Colpatria    → factor 1.0000 (REAL - base de calibración)
--   La Equidad       → factor 1.4118 (REAL - cotización Hotel Morrison)
--   Suramericana     → factor 2.2803 (REAL - cotización Hotel Morrison)
--   Seguros del Estado → factor 0.90 (ESTIMADO)
--   BBVA Seguros       → factor 0.92 (ESTIMADO)
--   Solidaria          → factor 0.95 (ESTIMADO)
--   HDI Seguros        → factor 1.05 (ESTIMADO)
--   Bolívar            → factor 1.08 (ESTIMADO)
--   MAPFRE             → factor 1.15 (ESTIMADO)
--   Allianz            → factor 1.18 (ESTIMADO)
--   Zurich             → factor 1.20 (ESTIMADO)
--   Mundial            → factor 0.88 (ESTIMADO - solo HOGAR)
-- =====================================================

-- ══ AXA COLPATRIA — factor 1.0000 (REAL) ═════════════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
-- PYME
('PYME','incendio',    0.000324,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000283,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('PYME','hmacc',       0.000162,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('PYME','hurtoCalif',  0.000971,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoSimple', 0.000486,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoDinero', 0.004047,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeDanio',    0.002428,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeMovil',    0.003238,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotMaq',      0.002024,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotVidrios',  0.000121,'BIEN_ESPECIFICO',  'Sin deducible'),
('PYME','rce',         0.000648,'LIMITE_RC',        '$1.000.000'),
('PYME','transValores',0.003238,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000280,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
-- HOGAR
('HOGAR','incendio',    0.000290,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000254,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000145,'VA_TOTAL_DM',     '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.000874,'CONTENIDOS',      '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoDinero', 0.004047,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeDanio',    0.002428,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.003238,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000121,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.000648,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000280,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
-- COPROPIEDAD
('COPROPIEDAD','incendio',    0.000308,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000269,'VA_TOTAL_DM',    '2% valor asegurable, mínimo 2 SMMLV'),
('COPROPIEDAD','hmacc',       0.000154,'VA_TOTAL_DM',    '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.000923,'CONTENIDOS',     '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.004047,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.002428,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotMaq',      0.002024,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000121,'BIEN_ESPECIFICO','Sin deducible'),
('COPROPIEDAD','rce',         0.000648,'LIMITE_RC',      '$1.000.000'),
('COPROPIEDAD','mejorasLoc',  0.000280,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
-- TRE
('TRE','incendio',    0.000324,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000283,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('TRE','hmacc',       0.000162,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('TRE','hurtoCalif',  0.000971,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoSimple', 0.000486,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoDinero', 0.004047,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeDanio',    0.002428,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeMovil',    0.003238,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotMaq',      0.002024,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotVidrios',  0.000121,'BIEN_ESPECIFICO',  'Sin deducible'),
('TRE','rce',         0.000648,'LIMITE_RC',        '$1.000.000'),
('TRE','transValores',0.003238,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000280,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'AXA'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ SURAMERICANA — factor 2.2803 (REAL) ══════════════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
-- PYME
('PYME','incendio',    0.000739,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000645,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 3 SMMLV'),
('PYME','hmacc',       0.000370,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('PYME','hurtoCalif',  0.002214,'CONTENIDOS',       '15% de la pérdida, mínimo 1 SMMLV'),
('PYME','hurtoSimple', 0.001108,'CONTENIDOS',       '15% de la pérdida, mínimo 1 SMMLV'),
('PYME','hurtoDinero', 0.009229,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 1 SMMLV'),
('PYME','eeeDanio',    0.005538,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeMovil',    0.007384,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotMaq',      0.004616,'BIEN_ESPECIFICO',  '16% de la pérdida, mínimo 1 SMMLV'),
('PYME','rotVidrios',  0.000276,'BIEN_ESPECIFICO',  'Sin deducible'),
('PYME','rce',         0.001478,'LIMITE_RC',        '$1.000.000'),
('PYME','transValores',0.007384,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000638,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
-- HOGAR
('HOGAR','incendio',    0.000661,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000579,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000331,'VA_TOTAL_DM',     '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.001993,'CONTENIDOS',      '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','hurtoDinero', 0.009229,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeDanio',    0.005538,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.007384,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000276,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.001478,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000638,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
-- COPROPIEDAD
('COPROPIEDAD','incendio',    0.000702,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000614,'VA_TOTAL_DM',    '2% valor asegurable, mínimo 3 SMMLV'),
('COPROPIEDAD','hmacc',       0.000351,'VA_TOTAL_DM',    '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.002104,'CONTENIDOS',     '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.009229,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.005538,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','rotMaq',      0.004616,'BIEN_ESPECIFICO','16% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000276,'BIEN_ESPECIFICO','Sin deducible'),
('COPROPIEDAD','rce',         0.001478,'LIMITE_RC',      '$1.000.000'),
('COPROPIEDAD','mejorasLoc',  0.000638,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
-- TRE
('TRE','incendio',    0.000739,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000645,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 3 SMMLV'),
('TRE','hmacc',       0.000370,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('TRE','hurtoCalif',  0.002214,'CONTENIDOS',       '15% de la pérdida, mínimo 1 SMMLV'),
('TRE','hurtoSimple', 0.001108,'CONTENIDOS',       '15% de la pérdida, mínimo 1 SMMLV'),
('TRE','hurtoDinero', 0.009229,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 1 SMMLV'),
('TRE','eeeDanio',    0.005538,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeMovil',    0.007384,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotMaq',      0.004616,'BIEN_ESPECIFICO',  '16% de la pérdida, mínimo 1 SMMLV'),
('TRE','rotVidrios',  0.000276,'BIEN_ESPECIFICO',  'Sin deducible'),
('TRE','rce',         0.001478,'LIMITE_RC',        '$1.000.000'),
('TRE','transValores',0.007384,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000638,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'SURA'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ LA EQUIDAD — factor 1.4118 (REAL) ════════════════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
-- PYME
('PYME','incendio',    0.000457,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000400,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 3 SMMLV'),
('PYME','hmacc',       0.000229,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 3 SMMLV'),
('PYME','hurtoCalif',  0.001371,'CONTENIDOS',       '10% de la pérdida, mínimo 4 SMMLV'),
('PYME','hurtoSimple', 0.000686,'CONTENIDOS',       '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoDinero', 0.005716,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 3 SMMLV'),
('PYME','eeeDanio',    0.003429,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','eeeMovil',    0.004572,'BIEN_ESPECIFICO',  '20% de la pérdida, mínimo 1.5 SMMLV'),
('PYME','rotMaq',      0.002858,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','rotVidrios',  0.000171,'BIEN_ESPECIFICO',  'Sin deducible'),
('PYME','rce',         0.000915,'LIMITE_RC',        '$1.000.000'),
('PYME','transValores',0.004572,'PRESUPUESTO_ANUAL','10% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000395,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
-- HOGAR
('HOGAR','incendio',    0.000409,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000359,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000205,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.001234,'CONTENIDOS',      '10% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoDinero', 0.005716,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','eeeDanio',    0.003429,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.004572,'BIEN_ESPECIFICO', '20% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000171,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.000915,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000395,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
-- COPROPIEDAD
('COPROPIEDAD','incendio',    0.000435,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000380,'VA_TOTAL_DM',    '2% valor asegurable, mínimo 2 SMMLV'),
('COPROPIEDAD','hmacc',       0.000218,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.001304,'CONTENIDOS',     '10% de la pérdida, mínimo 3 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.005716,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.003429,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotMaq',      0.002858,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000171,'BIEN_ESPECIFICO','Sin deducible'),
('COPROPIEDAD','rce',         0.000915,'LIMITE_RC',      '$1.000.000'),
('COPROPIEDAD','mejorasLoc',  0.000395,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
-- TRE
('TRE','incendio',    0.000457,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000400,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 3 SMMLV'),
('TRE','hmacc',       0.000229,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 3 SMMLV'),
('TRE','hurtoCalif',  0.001371,'CONTENIDOS',       '10% de la pérdida, mínimo 4 SMMLV'),
('TRE','hurtoSimple', 0.000686,'CONTENIDOS',       '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoDinero', 0.005716,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 3 SMMLV'),
('TRE','eeeDanio',    0.003429,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','eeeMovil',    0.004572,'BIEN_ESPECIFICO',  '20% de la pérdida, mínimo 1.5 SMMLV'),
('TRE','rotMaq',      0.002858,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','rotVidrios',  0.000171,'BIEN_ESPECIFICO',  'Sin deducible'),
('TRE','rce',         0.000915,'LIMITE_RC',        '$1.000.000'),
('TRE','transValores',0.004572,'PRESUPUESTO_ANUAL','10% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000395,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'EQUIDAD'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ SEGUROS DEL ESTADO — factor 0.90 (ESTIMADO) ═══════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
('PYME','incendio',    0.000292,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000255,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('PYME','hmacc',       0.000146,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('PYME','hurtoCalif',  0.000874,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoSimple', 0.000437,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoDinero', 0.003642,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeDanio',    0.002185,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeMovil',    0.002914,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotMaq',      0.001822,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotVidrios',  0.000109,'BIEN_ESPECIFICO',  'Sin deducible'),
('PYME','rce',         0.000583,'LIMITE_RC',        '$1.000.000'),
('PYME','transValores',0.002914,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000252,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','incendio',    0.000261,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000229,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000131,'VA_TOTAL_DM',     '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.000787,'CONTENIDOS',      '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoDinero', 0.003642,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeDanio',    0.002185,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.002914,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000109,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.000583,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000252,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','incendio',    0.000277,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000242,'VA_TOTAL_DM',    '2% valor asegurable, mínimo 2 SMMLV'),
('COPROPIEDAD','hmacc',       0.000139,'VA_TOTAL_DM',    '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.000831,'CONTENIDOS',     '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.003642,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.002185,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotMaq',      0.001822,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000109,'BIEN_ESPECIFICO','Sin deducible'),
('COPROPIEDAD','rce',         0.000583,'LIMITE_RC',      '$1.000.000'),
('COPROPIEDAD','mejorasLoc',  0.000252,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('TRE','incendio',    0.000292,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000255,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('TRE','hmacc',       0.000146,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('TRE','hurtoCalif',  0.000874,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoSimple', 0.000437,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoDinero', 0.003642,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeDanio',    0.002185,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeMovil',    0.002914,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotMaq',      0.001822,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotVidrios',  0.000109,'BIEN_ESPECIFICO',  'Sin deducible'),
('TRE','rce',         0.000583,'LIMITE_RC',        '$1.000.000'),
('TRE','transValores',0.002914,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000252,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'ESTADO'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ HDI SEGUROS — factor 1.05 (ESTIMADO) ════════════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
('PYME','incendio',    0.000340,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000297,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('PYME','hmacc',       0.000170,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('PYME','hurtoCalif',  0.001020,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoSimple', 0.000510,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoDinero', 0.004249,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeDanio',    0.002549,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeMovil',    0.003400,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotMaq',      0.002125,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotVidrios',  0.000127,'BIEN_ESPECIFICO',  'Sin deducible'),
('PYME','rce',         0.000680,'LIMITE_RC',        '$1.000.000'),
('PYME','transValores',0.003400,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000294,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','incendio',    0.000305,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000267,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000153,'VA_TOTAL_DM',     '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.000918,'CONTENIDOS',      '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoDinero', 0.004249,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeDanio',    0.002549,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.003400,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000127,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.000680,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000294,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','incendio',    0.000323,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000282,'VA_TOTAL_DM',    '2% valor asegurable, mínimo 2 SMMLV'),
('COPROPIEDAD','hmacc',       0.000162,'VA_TOTAL_DM',    '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.000969,'CONTENIDOS',     '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.004249,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.002549,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotMaq',      0.002125,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000127,'BIEN_ESPECIFICO','Sin deducible'),
('COPROPIEDAD','rce',         0.000680,'LIMITE_RC',      '$1.000.000'),
('COPROPIEDAD','mejorasLoc',  0.000294,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('TRE','incendio',    0.000340,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000297,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('TRE','hmacc',       0.000170,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('TRE','hurtoCalif',  0.001020,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoSimple', 0.000510,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoDinero', 0.004249,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeDanio',    0.002549,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeMovil',    0.003400,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotMaq',      0.002125,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotVidrios',  0.000127,'BIEN_ESPECIFICO',  'Sin deducible'),
('TRE','rce',         0.000680,'LIMITE_RC',        '$1.000.000'),
('TRE','transValores',0.003400,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000294,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'HDI'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ BOLÍVAR — factor 1.08 (ESTIMADO) ═════════════════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
('PYME','incendio',    0.000350,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000306,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('PYME','hmacc',       0.000175,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('PYME','hurtoCalif',  0.001049,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoSimple', 0.000525,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoDinero', 0.004371,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeDanio',    0.002622,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeMovil',    0.003497,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotMaq',      0.002186,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotVidrios',  0.000131,'BIEN_ESPECIFICO',  'Sin deducible'),
('PYME','rce',         0.000700,'LIMITE_RC',        '$1.000.000'),
('PYME','transValores',0.003497,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000302,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','incendio',    0.000313,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000274,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000157,'VA_TOTAL_DM',     '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.000944,'CONTENIDOS',      '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoDinero', 0.004371,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeDanio',    0.002622,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.003497,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000131,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.000700,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000302,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','incendio',    0.000332,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000291,'VA_TOTAL_DM',    '2% valor asegurable, mínimo 2 SMMLV'),
('COPROPIEDAD','hmacc',       0.000166,'VA_TOTAL_DM',    '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.000997,'CONTENIDOS',     '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.004371,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.002622,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotMaq',      0.002186,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000131,'BIEN_ESPECIFICO','Sin deducible'),
('COPROPIEDAD','rce',         0.000700,'LIMITE_RC',      '$1.000.000'),
('COPROPIEDAD','mejorasLoc',  0.000302,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('TRE','incendio',    0.000350,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000306,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('TRE','hmacc',       0.000175,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('TRE','hurtoCalif',  0.001049,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoSimple', 0.000525,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoDinero', 0.004371,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeDanio',    0.002622,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeMovil',    0.003497,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotMaq',      0.002186,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotVidrios',  0.000131,'BIEN_ESPECIFICO',  'Sin deducible'),
('TRE','rce',         0.000700,'LIMITE_RC',        '$1.000.000'),
('TRE','transValores',0.003497,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000302,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'BOLIVAR'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ MAPFRE — factor 1.15 (ESTIMADO) ══════════════════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
('PYME','incendio',    0.000373,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000325,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('PYME','hmacc',       0.000186,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('PYME','hurtoCalif',  0.001117,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoSimple', 0.000559,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoDinero', 0.004654,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeDanio',    0.002792,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeMovil',    0.003724,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotMaq',      0.002328,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotVidrios',  0.000139,'BIEN_ESPECIFICO',  'Sin deducible'),
('PYME','rce',         0.000745,'LIMITE_RC',        '$1.000.000'),
('PYME','transValores',0.003724,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000322,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','incendio',    0.000334,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000292,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000167,'VA_TOTAL_DM',     '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.001005,'CONTENIDOS',      '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoDinero', 0.004654,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeDanio',    0.002792,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.003724,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000139,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.000745,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000322,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','incendio',    0.000354,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000310,'VA_TOTAL_DM',    '2% valor asegurable, mínimo 2 SMMLV'),
('COPROPIEDAD','hmacc',       0.000177,'VA_TOTAL_DM',    '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.001062,'CONTENIDOS',     '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.004654,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.002792,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotMaq',      0.002328,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000139,'BIEN_ESPECIFICO','Sin deducible'),
('COPROPIEDAD','rce',         0.000745,'LIMITE_RC',      '$1.000.000'),
('COPROPIEDAD','mejorasLoc',  0.000322,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('TRE','incendio',    0.000373,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000325,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('TRE','hmacc',       0.000186,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('TRE','hurtoCalif',  0.001117,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoSimple', 0.000559,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoDinero', 0.004654,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeDanio',    0.002792,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeMovil',    0.003724,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotMaq',      0.002328,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotVidrios',  0.000139,'BIEN_ESPECIFICO',  'Sin deducible'),
('TRE','rce',         0.000745,'LIMITE_RC',        '$1.000.000'),
('TRE','transValores',0.003724,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000322,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'MAPFRE'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ SOLIDARIA — factor 0.95 (ESTIMADO) ═══════════════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
('PYME','incendio',    0.000308,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000269,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('PYME','hmacc',       0.000154,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('PYME','hurtoCalif',  0.000922,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoSimple', 0.000462,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoDinero', 0.003845,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeDanio',    0.002307,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeMovil',    0.003076,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotMaq',      0.001923,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotVidrios',  0.000115,'BIEN_ESPECIFICO',  'Sin deducible'),
('PYME','rce',         0.000616,'LIMITE_RC',        '$1.000.000'),
('PYME','transValores',0.003076,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000266,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','incendio',    0.000276,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000241,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000138,'VA_TOTAL_DM',     '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.000830,'CONTENIDOS',      '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoDinero', 0.003845,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeDanio',    0.002307,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.003076,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000115,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.000616,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000266,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','incendio',    0.000293,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000256,'VA_TOTAL_DM',    '2% valor asegurable, mínimo 2 SMMLV'),
('COPROPIEDAD','hmacc',       0.000146,'VA_TOTAL_DM',    '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.000877,'CONTENIDOS',     '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.003845,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.002307,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotMaq',      0.001923,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000115,'BIEN_ESPECIFICO','Sin deducible'),
('COPROPIEDAD','rce',         0.000616,'LIMITE_RC',      '$1.000.000'),
('COPROPIEDAD','mejorasLoc',  0.000266,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('TRE','incendio',    0.000308,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000269,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('TRE','hmacc',       0.000154,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('TRE','hurtoCalif',  0.000922,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoSimple', 0.000462,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoDinero', 0.003845,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeDanio',    0.002307,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeMovil',    0.003076,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotMaq',      0.001923,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotVidrios',  0.000115,'BIEN_ESPECIFICO',  'Sin deducible'),
('TRE','rce',         0.000616,'LIMITE_RC',        '$1.000.000'),
('TRE','transValores',0.003076,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000266,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'SOLIDARIA'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ BBVA SEGUROS — factor 0.92 (ESTIMADO) ════════════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
('PYME','incendio',    0.000298,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000260,'VA_TOTAL_DM',      '2% del valor total, mínimo 2 SMMLV'),
('PYME','hmacc',       0.000149,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','hurtoCalif',  0.000893,'CONTENIDOS',       '15% de la pérdida, mínimo 1.5 SMMLV'),
('PYME','hurtoSimple', 0.000447,'CONTENIDOS',       '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','hurtoDinero', 0.003723,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 1.5 SMMLV'),
('PYME','eeeDanio',    0.002234,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 1 SMMLV'),
('PYME','eeeMovil',    0.002979,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 1 SMMLV'),
('PYME','rotMaq',      0.001862,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 1 SMMLV'),
('PYME','rotVidrios',  0.000111,'BIEN_ESPECIFICO',  '1 SMMLV (con asistencia: sin deducible)'),
('PYME','rce',         0.000596,'LIMITE_RC',        'RC incluida al 20% del VA sin costo'),
('PYME','transValores',0.002979,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000258,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','incendio',    0.000267,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000234,'VA_TOTAL_DM',     '2% del valor total, mínimo 2 SMMLV'),
('HOGAR','hmacc',       0.000133,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','hurtoCalif',  0.000804,'CONTENIDOS',      '15% de la pérdida, mínimo 1.5 SMMLV'),
('HOGAR','hurtoDinero', 0.003723,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1.5 SMMLV'),
('HOGAR','eeeDanio',    0.002234,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.002979,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000111,'BIEN_ESPECIFICO', '1 SMMLV (con asistencia: sin deducible)'),
('HOGAR','rce',         0.000596,'LIMITE_RC',       'RC familiar incluida sin costo'),
('HOGAR','mejorasLoc',  0.000258,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','incendio',    0.000283,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000247,'VA_TOTAL_DM',    '2% del valor total, mínimo 2 SMMLV'),
('COPROPIEDAD','hmacc',       0.000141,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.000848,'CONTENIDOS',     '15% de la pérdida, mínimo 1.5 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.003723,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 1.5 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.002234,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotMaq',      0.001862,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000111,'BIEN_ESPECIFICO','1 SMMLV (con asistencia: sin deducible)'),
('COPROPIEDAD','rce',         0.000596,'LIMITE_RC',      'RC PH al 20% del VA sin costo'),
('COPROPIEDAD','mejorasLoc',  0.000258,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('TRE','incendio',    0.000298,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000260,'VA_TOTAL_DM',      '2% del valor total, mínimo 2 SMMLV'),
('TRE','hmacc',       0.000149,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','hurtoCalif',  0.000893,'CONTENIDOS',       '15% de la pérdida, mínimo 1.5 SMMLV'),
('TRE','hurtoSimple', 0.000447,'CONTENIDOS',       '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','hurtoDinero', 0.003723,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 1.5 SMMLV'),
('TRE','eeeDanio',    0.002234,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 1 SMMLV'),
('TRE','eeeMovil',    0.002979,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 1 SMMLV'),
('TRE','rotMaq',      0.001862,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 1 SMMLV'),
('TRE','rotVidrios',  0.000111,'BIEN_ESPECIFICO',  '1 SMMLV (con asistencia: sin deducible)'),
('TRE','rce',         0.000596,'LIMITE_RC',        'RC incluida al 20% del VA sin costo'),
('TRE','transValores',0.002979,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000258,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'BBVA'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ ZURICH — factor 1.20 (ESTIMADO) ══════════════════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
('PYME','incendio',    0.000389,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000340,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('PYME','hmacc',       0.000194,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('PYME','hurtoCalif',  0.001165,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoSimple', 0.000583,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoDinero', 0.004856,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeDanio',    0.002914,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeMovil',    0.003886,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotMaq',      0.002429,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotVidrios',  0.000145,'BIEN_ESPECIFICO',  'Sin deducible'),
('PYME','rce',         0.000778,'LIMITE_RC',        '$1.000.000'),
('PYME','transValores',0.003886,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000336,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','incendio',    0.000348,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000305,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000174,'VA_TOTAL_DM',     '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.001049,'CONTENIDOS',      '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoDinero', 0.004856,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeDanio',    0.002914,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.003886,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000145,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.000778,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000336,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','incendio',    0.000370,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000323,'VA_TOTAL_DM',    '2% valor asegurable, mínimo 2 SMMLV'),
('COPROPIEDAD','hmacc',       0.000185,'VA_TOTAL_DM',    '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.001108,'CONTENIDOS',     '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.004856,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.002914,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotMaq',      0.002429,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000145,'BIEN_ESPECIFICO','Sin deducible'),
('COPROPIEDAD','rce',         0.000778,'LIMITE_RC',      '$1.000.000'),
('COPROPIEDAD','mejorasLoc',  0.000336,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('TRE','incendio',    0.000389,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000340,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('TRE','hmacc',       0.000194,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('TRE','hurtoCalif',  0.001165,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoSimple', 0.000583,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoDinero', 0.004856,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeDanio',    0.002914,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeMovil',    0.003886,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotMaq',      0.002429,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotVidrios',  0.000145,'BIEN_ESPECIFICO',  'Sin deducible'),
('TRE','rce',         0.000778,'LIMITE_RC',        '$1.000.000'),
('TRE','transValores',0.003886,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000336,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'ZURICH'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ ALLIANZ — factor 1.18 (ESTIMADO) ═════════════════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
('PYME','incendio',    0.000382,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('PYME','terremoto',   0.000334,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('PYME','hmacc',       0.000191,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('PYME','hurtoCalif',  0.001146,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoSimple', 0.000573,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','hurtoDinero', 0.004775,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeDanio',    0.002865,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','eeeMovil',    0.003821,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotMaq',      0.002388,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('PYME','rotVidrios',  0.000143,'BIEN_ESPECIFICO',  'Sin deducible'),
('PYME','rce',         0.000765,'LIMITE_RC',        '$1.000.000'),
('PYME','transValores',0.003821,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('PYME','mejorasLoc',  0.000330,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','incendio',    0.000342,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000300,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000171,'VA_TOTAL_DM',     '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.001031,'CONTENIDOS',      '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoDinero', 0.004775,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeDanio',    0.002865,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.003821,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000143,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.000765,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000330,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','incendio',    0.000363,'VA_TOTAL_DM',    '10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','terremoto',   0.000317,'VA_TOTAL_DM',    '2% valor asegurable, mínimo 2 SMMLV'),
('COPROPIEDAD','hmacc',       0.000182,'VA_TOTAL_DM',    '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoCalif',  0.001089,'CONTENIDOS',     '15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','hurtoDinero', 0.004775,'BIEN_ESPECIFICO','15% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','eeeDanio',    0.002865,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('COPROPIEDAD','rotMaq',      0.002388,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 2 SMMLV'),
('COPROPIEDAD','rotVidrios',  0.000143,'BIEN_ESPECIFICO','Sin deducible'),
('COPROPIEDAD','rce',         0.000765,'LIMITE_RC',      '$1.000.000'),
('COPROPIEDAD','mejorasLoc',  0.000330,'BIEN_ESPECIFICO','10% de la pérdida, mínimo 1 SMMLV'),
('TRE','incendio',    0.000382,'VA_TOTAL_DM',      '10% de la pérdida, mínimo 1 SMMLV'),
('TRE','terremoto',   0.000334,'VA_TOTAL_DM',      '2% valor asegurable, mínimo 2 SMMLV'),
('TRE','hmacc',       0.000191,'VA_TOTAL_DM',      '15% de la pérdida, mínimo 3 SMMLV'),
('TRE','hurtoCalif',  0.001146,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoSimple', 0.000573,'CONTENIDOS',       '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','hurtoDinero', 0.004775,'BIEN_ESPECIFICO',  '15% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeDanio',    0.002865,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','eeeMovil',    0.003821,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotMaq',      0.002388,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 2 SMMLV'),
('TRE','rotVidrios',  0.000143,'BIEN_ESPECIFICO',  'Sin deducible'),
('TRE','rce',         0.000765,'LIMITE_RC',        '$1.000.000'),
('TRE','transValores',0.003821,'PRESUPUESTO_ANUAL','5% de la pérdida, mínimo 1 SMMLV'),
('TRE','mejorasLoc',  0.000330,'BIEN_ESPECIFICO',  '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'ALLIANZ'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;

-- ══ MUNDIAL — factor 0.88 (ESTIMADO) — SOLO HOGAR ════════════════════════════
INSERT INTO cotizador_tasas (aseguradora_id,producto,amparo,tasa,base_calculo,deducible_texto) 
SELECT a.id, v.producto, v.amparo, v.tasa, v.base_calculo, v.deducible_texto
FROM aseguradoras a, (VALUES
('HOGAR','incendio',    0.000255,'VA_TOTAL_DM',     '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','terremoto',   0.000224,'VA_TOTAL_DM',     '2% valor asegurable, mínimo 1 SMMLV'),
('HOGAR','hmacc',       0.000143,'VA_TOTAL_DM',     '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoCalif',  0.000769,'CONTENIDOS',      '15% de la pérdida, mínimo 2 SMMLV'),
('HOGAR','hurtoDinero', 0.003561,'BIEN_ESPECIFICO', '15% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeDanio',    0.002137,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','eeeMovil',    0.002849,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV'),
('HOGAR','rotVidrios',  0.000107,'BIEN_ESPECIFICO', 'Sin deducible'),
('HOGAR','rce',         0.000570,'LIMITE_RC',       '$500.000'),
('HOGAR','mejorasLoc',  0.000246,'BIEN_ESPECIFICO', '10% de la pérdida, mínimo 1 SMMLV')
) AS v(producto,amparo,tasa,base_calculo,deducible_texto)
WHERE a.nombre_corto = 'MUNDIAL'
ON CONFLICT (aseguradora_id, producto, amparo) DO UPDATE SET
  tasa = EXCLUDED.tasa,
  base_calculo = EXCLUDED.base_calculo,
  deducible_texto = EXCLUDED.deducible_texto;
