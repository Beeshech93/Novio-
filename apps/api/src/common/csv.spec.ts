import { parseCsv, toCsv } from './csv';

describe('csv', () => {
  it('parses quoted fields, commas, escaped quotes and CRLF', () => {
    const rows = parseCsv('name,price\r\n"Corte, clásico",100\r\n"Say ""hi""",5\r\n');
    expect(rows).toEqual([{ name: 'Corte, clásico', price: '100' }, { name: 'Say "hi"', price: '5' }]);
  });
  it('round-trips and neutralises formulas', () => {
    const out = toCsv(['name', 'price'], [{ name: '=HYPERLINK("x")', price: -5 }, { name: 'a,b', price: 1 }]);
    expect(out).toContain(`"'=HYPERLINK(""x"")"`);
    expect(out).toContain('-5');
    expect(parseCsv(out)[1]).toEqual({ name: 'a,b', price: '1' });
  });
});
