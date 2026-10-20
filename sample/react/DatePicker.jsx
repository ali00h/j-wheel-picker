import { useEffect, useRef } from 'react';
import { JWheelPicker } from 'j-wheel-picker';
import 'j-wheel-picker/css';

export function DatePicker({ value, onChange }) {
  const inputRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!inputRef.current) return;
    pickerRef.current = new JWheelPicker({
      target: inputRef.current,
      onSelect: (date) => onChange?.(date.formatted, date),
    });
    return () => {
      pickerRef.current?.destroy();
      pickerRef.current = null;
    };
  }, [onChange]);

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== (value ?? '')) {
      inputRef.current.value = value ?? '';
    }
  }, [value]);

  return <input ref={inputRef} defaultValue={value ?? ''} readOnly placeholder="YYYY/MM/DD" aria-haspopup="dialog" />;
}
