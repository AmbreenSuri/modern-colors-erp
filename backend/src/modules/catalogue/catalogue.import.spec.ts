import { CatalogueService } from './catalogue.service';

// previewImport() is a pure CSV/XLSX parser (item 5) — no DB. We feed CSV buffers and
// assert HSN detection, whitespace tolerance, empty-row skipping and invalid flagging.
describe('CatalogueService.previewImport (CSV import)', () => {
  const svc = new CatalogueService({} as never, {} as never);
  const preview = (csv: string) => svc.previewImport(Buffer.from(csv, 'utf8'));

  it('maps HSN Code into its own column and tolerates header/whitespace variants', () => {
    const csv = [
      'Material Name, SKU , HSN/SAC Code ,Unit',
      ' Titanium Dioxide , TIO2-001 , 28230010 , Bag ',
      'Iron Oxide Red,FEOR-110,32061190,Bag',
    ].join('\n');
    const p = preview(csv);
    expect(p.totalRows).toBe(2);
    expect(p.validRows).toBe(2);
    expect(p.detectedColumns).toEqual(expect.arrayContaining(['materialName', 'sku', 'hsnCode', 'unit']));
    expect(p.rows[0].materialName).toBe('Titanium Dioxide');
    expect(p.rows[0].sku).toBe('TIO2-001');
    expect(p.rows[0].hsnCode).toBe('28230010'); // its OWN column, not merged into sku
  });

  it('skips blank rows and flags rows missing a material name', () => {
    const csv = [
      'Material,HSN,SKU',
      'Acrylic Emulsion,39051200,ACEM-300',
      ',,', // fully empty → dropped
      ',12345678,ORPHAN', // has data but no name → invalid, surfaced (not silently dropped)
    ].join('\n');
    const p = preview(csv);
    expect(p.totalRows).toBe(2); // blank row dropped, orphan kept for the operator to see
    const invalid = p.rows.find((r) => !r.valid);
    expect(invalid?.error).toMatch(/material name/i);
  });
});
