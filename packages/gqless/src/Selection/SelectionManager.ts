import { Selection, SelectionType } from './selection';

export class SelectionManager {
  separateSelectionTypes(selections: Selection[] | Set<Selection>) {
    const querySelections: Selection[] = [];
    const mutationSelections: Selection[] = [];
    const subscriptionSelections: Selection[] = [];

    for (const selection of selections) {
      switch (selection.type) {
        case SelectionType.Query: {
          querySelections.push(selection);
          break;
        }
        case SelectionType.Mutation: {
          mutationSelections.push(selection);
          break;
        }
        case SelectionType.Subscription: {
          subscriptionSelections.push(selection);
          break;
        }
        default:
      }
    }

    return {
      querySelections,
      mutationSelections,
      subscriptionSelections,
    };
  }
}
