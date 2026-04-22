# Income and Expenses Page - Component Structure

## 📁 Folder Structure

```
income-expenses/
├── index.tsx                      # Main page component
├── types.ts                       # TypeScript type definitions
├── context/
│   └── IncomeExpenseContext.tsx   # Global state management
└── components/
    ├── CarHeader.tsx              # Car information display
    ├── TableActions.tsx           # Year selector, Save, Export buttons
    ├── IncomeExpenseTable.tsx     # Main data table
    ├── EditableCell.tsx           # Individual editable cell
    └── EditPanel.tsx              # Right sidebar edit panel
```

## 🏗️ Component Architecture

### 1. **Main Page** (`index.tsx`)
- Entry point for the page
- Handles routing and authentication
- Provides context to child components
- Manages breadcrumb navigation
- Layout orchestration

### 2. **Context** (`IncomeExpenseContext.tsx`)
- Global state management using React Context
- Handles data fetching via React Query
- Manages editing state
- Handles save operations
- Month toggle state management
- **Key features:**
  - Centralized data access
  - Pending changes tracking
  - Mutation handling
  - Cache invalidation

### 3. **Car Header** (`CarHeader.tsx`)
- Displays car information (VIN, license, make/model)
- Shows owner information (name, contact, email)
- Shows car specifications (fuel, tire size, oil type)
- Shows Turo links
- **Props:** `car`, `onboarding`

### 4. **Table Actions** (`TableActions.tsx`)
- Year selector dropdown
- Save button with loading state
- Export dropdown menu (CSV, JSON, Clipboard, Print)
- Log button
- **Props:** `selectedYear`, `setSelectedYear`, `carId`, `car`

### 5. **Income Expense Table** (`IncomeExpenseTable.tsx`)
- Main data table component
- **Features:**
  - Sticky header with month toggles
  - Collapsible category sections
  - Renders all editable and calculated rows
  - Responsive column widths
- **Sub-components:**
  - `CategorySection` - Collapsible section headers
  - `CategoryRow` - Individual data rows with cells

### 6. **Editable Cell** (`EditableCell.tsx`)
- Individual cell component
- **Features:**
  - Click to edit inline
  - Automatic focus and select on edit
  - Save on blur or Enter key
  - Cancel on Escape key
  - Visual feedback for active editing
  - Supports both decimal and integer values
- **Props:**
  - `value` - Current cell value
  - `month` - Month number (1-12)
  - `category` - Category name (income, directDelivery, etc.)
  - `field` - Field name (rentalIncome, laborCarCleaning, etc.)
  - `isEditable` - Whether cell can be edited
  - `isInteger` - Whether to show as integer (for history data)

### 7. **Edit Panel** (`EditPanel.tsx`)
- Right sidebar that appears when editing
- Shows currently selected cell details
- **Features:**
  - Date display
  - Form amount input
  - Calculated totals
  - Remarks textarea
  - File upload section
  - Save and Cancel buttons
- **Auto-hides** when no cell is being edited

## 🎯 Data Flow

```
User Interaction
    ↓
EditableCell Component
    ↓
Updates Context (editingCell state)
    ↓
EditPanel Shows (reactive to editingCell)
    ↓
User Modifies Value
    ↓
Context Tracks Pending Changes
    ↓
User Clicks Save
    ↓
Context Sends API Requests
    ↓
React Query Invalidates Cache
    ↓
Table Re-renders with New Data
```

## 🔄 State Management

### Context State:
- `data` - All income/expense data from API
- `isLoading` - Loading state
- `editingCell` - Currently editing cell (or null)
- `pendingChanges` - Map of unsaved changes
- `monthToggles` - Which months are visible
- `isSaving` - Save operation in progress

### Actions:
- `setEditingCell(cell)` - Set active editing cell
- `updateCell(category, field, month, value)` - Track change
- `saveChanges()` - Save all pending changes
- `toggleMonth(month)` - Show/hide month column

## 🎨 Styling

### Color Scheme:
- Background: `#0f0f0f`, `#1a1a1a`
- Borders: `#2a2a2a`
- Text: White, gray variations
- Accent: `#D3BC8D` (yellow/gold)
- Success: Green for save button
- Hover: `#252525`, `#2a2a2a`

### Layout:
- Sticky headers (top and left)
- Scrollable table body
- Fixed-width right panel (350px)
- Responsive column widths
- Collapsible sections

## 🔧 Customization

### Adding a New Category:

1. **Update types.ts:**
```typescript
export interface NewCategoryMonth {
  month: number;
  newField1: number;
  newField2: number;
}
```

2. **Update context (getEmptyData):**
```typescript
newCategory: emptyMonthData.map((m) => ({
  ...m,
  newField1: 0,
  newField2: 0,
})),
```

3. **Add category to IncomeExpenseTable:**
```tsx
<CategorySection
  title="NEW CATEGORY"
  isExpanded={expandedSections.newCategory}
  onToggle={() => toggleSection("newCategory")}
>
  <CategoryRow
    label="New Field 1"
    values={MONTHS.map((_, i) => getMonthValue(data.newCategory, i + 1, "newField1"))}
    monthToggles={monthToggles}
    category="newCategory"
    field="newField1"
  />
</CategorySection>
```

4. **Add backend endpoint:**
```typescript
app.post("/api/income-expense/new-category", async (req, res) => {
  // Handle update
});
```

### Adding a New Editable Field:

Just add a new `<CategoryRow>` with appropriate props:
```tsx
<CategoryRow
  label="New Income Source"
  values={MONTHS.map((_, i) => getMonthValue(data.incomeExpenses, i + 1, "newField"))}
  monthToggles={monthToggles}
  category="income"
  field="newField"
/>
```

## 🐛 Debugging

### Enable Debug Logging:
Add to context:
```typescript
console.log('[INCOME-EXPENSE] Current editing:', editingCell);
console.log('[INCOME-EXPENSE] Pending changes:', pendingChanges);
```

### Common Issues:

**Cells not editable:**
- Check `isEditable` prop on CategoryRow
- Verify category and field props are set
- Check month toggles are enabled

**Changes not saving:**
- Check browser console for errors
- Verify API endpoint is correct
- Check network tab for failed requests
- Ensure user is authenticated

**Values not updating:**
- Check React Query cache invalidation
- Verify response from API is correct
- Check serialization of BigInt/Decimal values

## 📊 Performance Optimization

### Current Optimizations:
- Memoized calculations in useMemo
- React Query caching
- Lazy loading of components
- Optimistic updates possible

### Future Improvements:
- Virtual scrolling for large datasets
- Debounced save operations
- Batch update API
- WebSocket for real-time updates

## 🧪 Testing

### Unit Tests (TODO):
```typescript
describe('EditableCell', () => {
  it('should render value correctly', () => {});
  it('should enter edit mode on click', () => {});
  it('should save on blur', () => {});
  it('should cancel on escape', () => {});
});
```

### Integration Tests (TODO):
- Test full edit workflow
- Test data persistence
- Test calculations accuracy
- Test export functionality

## 📝 Notes

- All monetary values use DECIMAL(10,2) in database
- Months are numbered 1-12 (not 0-11)
- Toggle switches control column visibility
- Calculated fields are read-only (no category/field props)
- Total column always shows sum of visible months
