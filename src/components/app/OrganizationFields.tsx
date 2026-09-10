import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import { Office, Region } from '../../types';
import { ErrorNotice, Field } from './Primitives';

export function OrganizationFields({ region, office, onChange }: { region: string; office: string; onChange: (region: string, office: string) => void }) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    apiService.getRegions().then(res => {
      if (!live) return;
      if (res.status === 'success') setRegions(res.data || []);
      else setError(res.message || 'Regional belum tersedia.');
    });
    return () => { live = false; };
  }, [retry]);

  useEffect(() => {
    let live = true;
    setOffices([]);
    if (region) {
      apiService.getOffices(region).then(res => {
        if (!live) return;
        if (res.status === 'success') setOffices(res.data || []);
      });
    }
    return () => { live = false; };
  }, [region, retry]);

  return (
    <>
      <div className="form-grid">
        <Field label="Regional" required>
          <select
            className="input"
            value={region}
            required
            onChange={e => onChange(e.target.value, office)}
          >
            <option value="">Pilih regional</option>
            {regions.map(item => (
              <option key={item.region_id} value={item.region_id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Kantor penempatan"
          required
          hint="Ketik nama kantor atau unit kerja Anda saat ini secara manual."
        >
          <input
            className="input"
            type="text"
            list="office-suggestions"
            value={office}
            required
            maxLength={150}
            placeholder="Contoh: KCU Bandung / KCP Soreang / Kantor Pos..."
            onChange={e => onChange(region, e.target.value)}
          />
          {offices.length > 0 && (
            <datalist id="office-suggestions">
              {offices.map(item => (
                <option key={item.office_id} value={item.name}>
                  {item.code ? `${item.name} (${item.code})` : item.name}
                </option>
              ))}
            </datalist>
          )}
        </Field>
      </div>
      <ErrorNotice message={error} retry={() => setRetry(value => value + 1)} />
    </>
  );
}
