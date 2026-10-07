import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../src/components/ui/select";
import { SearchableNativeSelect, SearchableOption } from "../../src/components/ui/searchable-native-select";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../../src/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../../src/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "../../src/components/ui/command";
import { optionKeywords } from "../../src/lib/select-search";
import "../../src/index.css";

const cars = Array.from({ length: 120 }, (_, index) => ({ id: String(index), name: `Car ${index}`, make: index === 99 ? "BMW" : "Ford", model: index === 99 ? "X5" : "Explorer", year: index === 99 ? 2025 : 2020, licensePlate: index === 99 ? "ABC-123" : `PLATE${index}`, vin: index === 99 ? "5UXCR6C05S9X12345" : `VIN${index}` }));

function CarPicker({ testId }: { testId: string }) {
  const [value, setValue] = useState("1");
  return <Select value={value} onValueChange={setValue} name={testId}>
    <SelectTrigger data-testid={testId}><SelectValue /></SelectTrigger>
    <SelectContent>{cars.map((car) => <SelectItem key={car.id} value={car.id} searchKeywords={optionKeywords(car)}>{car.name}</SelectItem>)}</SelectContent>
  </Select>;
}

function Harness() {
  const [native, setNative] = useState("");
  const [employee, setEmployee] = useState("");
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState("");
  return <main className="mx-auto max-w-md space-y-5 p-4">
    <CarPicker testId="cars" />
    <form onSubmit={(event) => { event.preventDefault(); setSubmitted(String(new FormData(event.currentTarget).get("native"))); }}>
      <label htmlFor="native-picker">Native-compatible car picker</label>
      <SearchableNativeSelect id="native-picker" name="native" value={native} required onChange={(event) => setNative(event.target.value)}>
        <SearchableOption value="">Choose a car</SearchableOption>
        {cars.map((car) => <SearchableOption key={car.id} value={car.id} searchKeywords={optionKeywords(car)}>{car.name}</SearchableOption>)}
        <SearchableOption value="disabled" disabled>Unavailable</SearchableOption>
      </SearchableNativeSelect>
      <button type="submit">Save selection</button>
      <output data-testid="submitted">{submitted}</output>
    </form>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button data-testid="employees" type="button">{employee || "Choose employee"}</button></PopoverTrigger>
      <PopoverContent><Command><CommandInput placeholder="Search employees" /><CommandList><CommandEmpty>No employees found.</CommandEmpty>
        {[{ id: "1", name: "José Rivera", email: "jose@example.com", department: "Operations" }, { id: "2", name: "Amy Smith", email: "amy@example.com", department: "Finance" }].map((person) => <CommandItem key={person.id} value={person.name} keywords={optionKeywords(person)} onSelect={() => { setEmployee(person.name); setOpen(false); }}>{person.name}</CommandItem>)}
      </CommandList></Command></PopoverContent>
    </Popover>
    <Dialog><DialogTrigger asChild><button type="button">Open modal</button></DialogTrigger><DialogContent><DialogTitle>Assign vehicle</DialogTitle><CarPicker testId="modal-cars" /></DialogContent></Dialog>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
