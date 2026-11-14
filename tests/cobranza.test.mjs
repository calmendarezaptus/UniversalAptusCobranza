import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const toModule = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText).toString('base64')
const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8')
const api = read('../src/lib/api.ts').replace(/import\.meta\.env\.DEV/g, 'true').replace(/import\.meta\.env\.\w+/g, 'undefined')
const lib = await import(toModule(read('../src/lib/cobranza.ts').replace("from './api'", `from '${toModule(api)}'`)))

test('estado de cuenta: cliente obligatorio, fechas en orden, query mínima', () => {
  const f = { cliente_id: '446794000018976759', estado: 'pendientes', desde: '', hasta: '' }
  assert.equal(lib.validateEstadoCuenta({ ...f, cliente_id: '' }), 'Elige el cliente.')
  assert.equal(lib.validateEstadoCuenta({ ...f, desde: '2026-02-01', hasta: '2026-01-01' }), 'La fecha inicial es posterior a la final.')
  assert.equal(lib.validateEstadoCuenta(f), null)
  assert.equal(lib.queryEstadoCuenta(f), 'cliente_id=446794000018976759')
  assert.equal(lib.queryEstadoCuenta({ ...f, estado: 'todas', hasta: '2026-11-14' }), 'cliente_id=446794000018976759&estado=todas&hasta=2026-11-14')
})

test('LEDES: prebill numérica e ids acotados', () => {
  const o = { client_id: '', client_matter_id: '', law_firm_id: '' }
  assert.equal(lib.validateLedes('', o), 'Escribe el número de Prebill.')
  assert.equal(lib.validateLedes('3', o), null)
  assert.match(lib.validateLedes('3', { ...o, client_matter_id: 'a'.repeat(41) }), /Asunto del cliente/)
  assert.match(lib.validateLedes('3', { ...o, law_firm_id: '<x>' }), /ID del despacho/)
  assert.equal(lib.queryLedes({ ...o, client_matter_id: ' P-5 ' }), '?client_matter_id=P-5')
  assert.equal(lib.queryLedes(o), '')
})

test('clientes: solo activos, con su moneda', () => {
  assert.deepEqual(lib.clienteOptions([{ id: '1', zoho_id: '1', nombre: 'A', status: 'active', moneda: 'MXN' }, { id: '2', nombre: 'B', status: 'inactive' }]),
    [{ ID: '1', display: 'A', secondary: 'MXN' }])
})

test('CSV del estado de cuenta y nombre de archivo seguro', () => {
  const ec = { cliente: { nombre: '00001 Avolar' }, fecha_corte: '2026-11-14', facturas: [{ numero: 'INV-1', fecha: '2024-05-08', vence: '2024-05-08', status: 'overdue', moneda: 'MXN', total: 174, pagos: 0, saldo: 174, dias_vencidos: 920, referencia: '=cmd' }] }
  const csv = lib.estadoCuentaCsv(ec)
  assert.ok(csv.startsWith('﻿Cliente,Factura'))
  assert.ok(csv.includes('Vencida'))
  assert.ok(csv.includes("'=cmd"))
  assert.equal(lib.archivo('A/B: "C" <D>'), 'A-B- -C- -D-')
})

test('lecturas: error con el mensaje de la API; forma inesperada falla; ruta correcta', async () => {
  const original = globalThis.fetch
  try {
    let url
    globalThis.fetch = async u => { url = u; return new Response(JSON.stringify({ tipo: 'estado_cuenta', facturas: [], totales_por_moneda: [], cliente: { zoho_id: '9', nombre: 'X' } }), { status: 200 }) }
    await lib.getEstadoCuenta('636939444', { cliente_id: '9', estado: 'pendientes', desde: '', hasta: '' })
    assert.equal(url, '/api/636939444/estado-cuenta?cliente_id=9')
    globalThis.fetch = async u => { url = u; return new Response(JSON.stringify({ formato: 'LEDES1998B', filas: [], texto: '' }), { status: 200 }) }
    await lib.getLedes('1', ' 3 ', { client_id: '', client_matter_id: '', law_firm_id: '' })
    assert.equal(url, '/api/1/ledes/3')
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'La Prebill no existe.' }), { status: 404 })
    await assert.rejects(lib.getLedes('1', '99', { client_id: '', client_matter_id: '', law_firm_id: '' }), /no existe/)
    globalThis.fetch = async () => new Response(JSON.stringify({ facturas: 'x' }), { status: 200 })
    await assert.rejects(lib.getFacturasCfdi('1'), /inesperada/)
    globalThis.fetch = async () => { throw new TypeError('x') }
    await assert.rejects(lib.getClientes('1'), /conexión/)
  } finally { globalThis.fetch = original }
})
