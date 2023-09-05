import Container from '@mui/material/Container';

import { Page } from '../../components/Page';
import { GroceryListForPlanning } from './GroceryListForPlanning';
import { PlanPageHeader } from './PlanPageHeader';
import { AutocompleteForPlanning } from './AutocompleteForPlanning';
import { usePlanState } from './usePlanState';

export function Plan({ core }) {
  const {
    cart,
    recentlyChangedItems,
    onItemsModified,
    GroceryFormEditDialog,
    ClearListDialog
  } = usePlanState(core);

  return (
    <Page
      header={<PlanPageHeader cartTotal={cart.total} />}
      body={
        <Container>
          <AutocompleteForPlanning
            core={core}
            items={cart.all}
            onItemsModified={onItemsModified} />
          <GroceryListForPlanning
            core={core}
            items={cart.shoppingList}
            onItemsModified={onItemsModified}
            recentlyChangedItems={recentlyChangedItems}
            allowAddingRecurringItems={cart.recurringItemsToAdd.length > 0}
            allowClearingTheList={cart.shoppingList.length}
            openClearListDialog={ClearListDialog.open}
            openEditDialog={GroceryFormEditDialog.open}
          />
        </Container>
      }
      dialogs={<>
        <ClearListDialog itemsCount={cart.shoppingList.length} />
        <GroceryFormEditDialog />
      </>}
    />
  );
}
