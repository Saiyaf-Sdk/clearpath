import useFaculties from '../hooks/useFaculties';

export const facultyShort = (name = '') => name.replace(/^Faculty of\s+/i, '');

// Drop-down of the university's faculties.
// all: adds "All faculties" (value '') · central: adds "Central (university-wide)" (value 'central')
export default function FacultySelect({ value, onChange, all = false, central = false, required = false, className = 'input', id, label = 'Faculty', disabled }) {
  const { faculties } = useFaculties();
  return (
    <select id={id} className={className} value={value ?? ''} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled} aria-label={label}>
      {all && <option value="">All faculties</option>}
      {!all && !central && <option value="" disabled>Choose a faculty…</option>}
      {central && <option value="central">Central (university-wide)</option>}
      {(faculties || []).map((f) => (
        <option key={f._id} value={f._id}>{facultyShort(f.name)}{f.isActive ? '' : ' (inactive)'}</option>
      ))}
    </select>
  );
}
