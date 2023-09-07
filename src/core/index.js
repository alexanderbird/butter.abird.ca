import { Chronometer } from './Chronometer';

export class Core {
  constructor(data, chronometer) {
    this.chronometer = chronometer || new Chronometer();
    this.data = data;
    this.shoppingListConsumers = {};
  }

  startShopping(attributes) {
    const shoppingEvent = {
      Id: this._generateTimestampId("s-", 4) + "#description",
      Status: "IN_PROGRESS",
      ...attributes,
    };
    this.shoppingEvent = shoppingEvent;
    this.data.createItem(shoppingEvent);
    return shoppingEvent;
  }

  buyItem(shoppingEventId, attributes) {
    const itemId = attributes.ItemId;
    if (!shoppingEventId.startsWith("s-")) {
      throw new Error('Shopping event Id must start with "s-"');
    }
    if (!itemId) {
      throw new Error("Missing required attribute 'ItemId'");
    }
    if (!itemId.startsWith("i-")) {
      throw new Error('ItemId must start with "i-"');
    }
    const fullShoppingEventId = this._withSuffix(shoppingEventId, "#description");
    const shoppingEvent = this.data.getItem(fullShoppingEventId);
    if (!shoppingEvent) {
      throw new Error(`No such shopping event "${fullShoppingEventId}"`);
    }
    if (shoppingEvent.Status !== "IN_PROGRESS") {
      throw new Error(`Cannot buy an item for a shopping event with status "${shoppingEvent.Status}"`);
    }
    const idSuffix = '#' + itemId;
    const boughtItem = {
      Id: fullShoppingEventId.replace(/#description$/, idSuffix),
      ...attributes
    }
    this.data.createItem(boughtItem);
    return boughtItem;
  }

  getShoppingEvent(id) {
    if (!id.match(/^s-.*#description$/)) {
      throw new Error('The shopping event description ID must start with "s-" and end with "#description"');
    }
    const description = this.data.getItem(id);
    const completedItems = Object.fromEntries(
      this.data.listItems(id.replace(/#description$/, '#i-'))
        .map(x => [x.Id.replace(/^s-[0-9a-z-]+#/, ''), x]));
    const list = this.data.listItems("i-")
      .filter(x => x.PlannedQuantity)
      .map(plannedItem => {
        const completedItem = completedItems[plannedItem.Id];
        return ({
          Id: plannedItem.Id,
          Name: plannedItem.Name,
          RequiredQuantity: plannedItem.PlannedQuantity,
          UnitPriceEstimate: plannedItem.UnitPriceEstimate,
          BoughtQuantity: completedItem?.Quantity || 0,
          ActualUnitPrice: completedItem?.ActualUnitPrice
        })
      });
    return {
      description,
      list
    }
  }

  stopShopping(id) {
    const shoppingEvent = this.data.getItem(id);
    if (!shoppingEvent) {
      throw new Error(`Cannot stop Shopping Event ${id}`);
    }
    this.data.updateItem({ Id: id, Status: "COMPLETE" });
  }

  offShoppingListUpdate(key) {
    delete this.shoppingListConsumers[key];
  }

  onShoppingListUpdate(key, consumeShoppingList) {
    this.shoppingListConsumers[key] = { key, consumeShoppingList };
  }

  addRecurringItems() {
    const toAdd = this.getShoppingPlan().recurringItemsToAdd;
    const currentTimestamp = this._getCurrentTimestamp();
    this.data.batchUpdateItems(toAdd.map(item => ({
      id: item.Id,
      updates: [
        {
          value: currentTimestamp,
          attributeName: 'LastUpdated',
        },
        {
          value: Math.max(item.PlannedQuantity, item.RecurringQuantity),
          attributeName: "PlannedQuantity"
        }
      ]
    })));
    return toAdd.map(x => x.Id);
  }

  addToItemPlannedQuantity(id, addend) {
    this.data.addItemValue(id, "PlannedQuantity", addend);
  }

  addToItemRecurringQuantity(id, addend) {
    this.data.addItemValue(id, "RecurringQuantity", addend);
  }

  removeItemsFromShoppingList(itemIds) {
    const currentTimestamp = this._getCurrentTimestamp();
    this.data.batchUpdateItems(itemIds.map(id => ({
      id,
      updates: [
        {
          value: currentTimestamp,
          attributeName: 'LastUpdated',
        },
        {
          value: 0,
          attributeName: "PlannedQuantity"
        }
      ]
    })));
  }

  getItem(id) {
    return this._supplyMissingFields(this.data.getItem(id));
  }

  updateItem(attributes) {
    this.data.updateItem(attributes);
  }

  createItem(attributes) {
    if (!attributes.Name) {
      throw new Error("Name is required.");
    }
    const item = {
      ...attributes,
      LastUpdated: this._getCurrentTimestamp(),
      Id: this._generateId("i-", 12),
    };
    this.data.createItem(item);
    return this._supplyMissingFields(item);
  }

  updateItemAndTimestamp(attributes) {
    this.data.updateItem({
      ...attributes,
      LastUpdated: this._getCurrentTimestamp(),
    });
  }

  getShoppingList() {
    const caller = (new Error()).stack.split("\n")[2].trim().split(" ")[1];
    console.warn(`DEPRECATED. Use getShoppingPlan() instead. (Called from ${caller})`);
    return this.getShoppingPlan();
  }
  
  getShoppingPlan() {
    const all = [];
    const shoppingList = [];
    const unselectedItems = [];
    let total = 0;
    let totalOfRecurringItems = 0;
    const recurringItemsToAdd = [];
    const recurringItems = [];
    this.data.listItems("i-").map(item => this._supplyMissingFields(item)).forEach(item => {
      all.push(item);
      if (item.RecurringQuantity) {
        recurringItems.push(item);
        totalOfRecurringItems += item.RecurringQuantity * item.UnitPriceEstimate;

        if (item.PlannedQuantity < item.RecurringQuantity) {
          recurringItemsToAdd.push(item);
        }
      }
      if (item.PlannedQuantity) {
        shoppingList.push(item);
        total += item.PlannedQuantity * item.UnitPriceEstimate;
      } else {
        unselectedItems.push(item);
      }
    });
    const result = { all, shoppingList, unselectedItems, recurringItems, recurringItemsToAdd, total, totalOfRecurringItems };
    setTimeout(() => {
      Object.values(this.shoppingListConsumers).forEach(consumer => consumer.consumeShoppingList(result));
    });
    return result;
  }

  _supplyMissingFields(item) {
    return {
      LastUpdated: '0000-00-00T00:00:00.000Z',
      PlannedQuantity: 0,
      RecurringQuantity: 0,
      UnitPriceEstimate: 0,
      Type: "OTHER",
      ...item
    };
  }

  _getCurrentTimestamp() {
    return this.chronometer.getCurrentTimestamp();
  }

  _generateId(prefix, length) {
    const randomPart = (
      Math.random().toString(36).slice(2)
      + Math.random().toString(36).slice(2)
    ).slice(0, length);
    return prefix + randomPart;
  }

  _generateTimestampId(prefix) {
    const timestampPart = this._getCurrentTimestamp()
      .replace(/\d\d\.\d\d\dZ/, '')
      .replace(/[^\d]/g, '');
    return [
      prefix,
      timestampPart,
      this._generateId("-", 6)
    ].join("");
  }

  _withSuffix(id, suffix) {
    if (id.endsWith(suffix)) {
      return id;
    }
    return id + suffix;
  }
}
