type SortInformation = {
  lastSortedField: string | null;
  order: string | null;
};

type ReturnValue = {
  sortedList: TokenType[];
  sortInfo: SortInformation;
};

const sortAsc = (el1: TokenType, el2: TokenType, field: string) => {
  if (el1[field as keyof TokenType] < el2[field as keyof TokenType]) return -1;
  else if (el1[field as keyof TokenType] > el2[field as keyof TokenType])
    return 1;
  else return 0;
};

const sortDesc = (el1: TokenType, el2: TokenType, field: string) => {
  if (el1[field as keyof TokenType] > el2[field as keyof TokenType]) return -1;
  else if (el1[field as keyof TokenType] < el2[field as keyof TokenType])
    return 1;
  else return 0;
};

function sortTokens(
  tokenList: TokenType[],
  field: string,
  lastSortInfo: SortInformation,
): ReturnValue {
  // if sortInfo.lastSortedField not field then sort list and update list state
  // if sortInfo.lastSortedField equal to field sort by opposite of current state then update list state

  let sortInfo: SortInformation = {
    lastSortedField: null,
    order: null,
  };
  const sortedList: TokenType[] = [...tokenList].sort(
    (el1: TokenType, el2: TokenType) => {
      if (
        lastSortInfo.lastSortedField !== field ||
        lastSortInfo.order === 'desc'
      ) {
        sortInfo = {
          lastSortedField: field,
          order: 'asc',
        };
        return sortAsc(el1, el2, field);
      } else {
        sortInfo = {
          lastSortedField: field,
          order: 'desc',
        };
        return sortDesc(el1, el2, field);
      }
    },
  );

  return {
    sortedList,
    sortInfo,
  };
}

export default sortTokens;
