export function LycProgress({steps}:{steps:{label:string;done:boolean}[]}) {
  return <ol aria-label="LYC program progress" className="grid gap-2 sm:grid-cols-5">
    {steps.map((step,index)=><li key={step.label} className={`rounded-lg border p-3 text-sm ${step.done?'border-primary bg-primary/10':'bg-muted/30 text-muted-foreground'}`}>
      <span className="mb-1 block font-semibold">{step.done?'✓':index+1}</span>{step.label}
    </li>)}
  </ol>;
}
