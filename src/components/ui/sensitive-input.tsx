import * as React from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

type SensitiveInputProps = Omit<React.ComponentProps<typeof Input>, 'type'> & {
  visibilityLabel: string;
};

/** Reveal only this field; keep its value, label, validation and form ref intact. */
export const SensitiveInput = React.forwardRef<HTMLInputElement, SensitiveInputProps>(
  ({ visibilityLabel, id, className, disabled, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const [visible, setVisible] = React.useState(false);
    React.useEffect(() => {
      const hide = () => { if (document.hidden) setVisible(false); };
      document.addEventListener('visibilitychange', hide);
      return () => document.removeEventListener('visibilitychange', hide);
    }, []);
    return <div className="relative min-w-0">
      <Input {...props} ref={ref} id={inputId} disabled={disabled}
        type={visible ? 'text' : 'password'} autoComplete="off" spellCheck={false}
        className={cn(className, 'pr-20')} />
      <button type="button" disabled={disabled} aria-controls={inputId}
        aria-label={`${visible ? 'Hide' : 'Show'} ${visibilityLabel}`}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex min-w-16 items-center justify-center rounded-r-md border-l border-input px-3 text-sm font-medium text-foreground hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setVisible(value => !value)}>
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>;
  },
);
SensitiveInput.displayName = 'SensitiveInput';
