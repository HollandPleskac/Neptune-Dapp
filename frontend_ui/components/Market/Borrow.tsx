import { useState } from 'react';
import InfoIcon from '../../assets/InfoIcon';
import TokenLabels from './TokenLabels';
import Token from './Token';

type SortInformation = {
  lastSortedField: string | null;
  order: string | null;
};

const Lend = ({ borrowTokensInitial }: Props) => {
  const [borrowTokens, setBorrowTokens] =
    useState<TokenType[]>(borrowTokensInitial);
  const [sortInfo, setSortInfo] = useState<SortInformation>({
    lastSortedField: null,
    order: null,
  });

  function sortBorrowHandler(field: string) {
    // if sortInfo.lastSortedField not field then sort list and update list state
    // if sortInfo.lastSortedField equal to field sort by opposite of current state then update list state

    const sortedList: TokenType[] = [...borrowTokens].sort(
      (el1: TokenType, el2: TokenType) => {
        if (sortInfo.lastSortedField !== field || sortInfo.order === 'desc') {
          // sort ascending
          setSortInfo({
            lastSortedField: field,
            order: 'asc',
          });
          if (el1[field as keyof TokenType] < el2[field as keyof TokenType])
            return -1;
          if (el1[field as keyof TokenType] > el2[field as keyof TokenType])
            return 1;
          return 0;
        } else {
          // sort descending
          setSortInfo({
            lastSortedField: field,
            order: 'desc',
          });
          if (el1[field as keyof TokenType] > el2[field as keyof TokenType])
            return -1;
          if (el1[field as keyof TokenType] < el2[field as keyof TokenType])
            return 1;
          return 0;
        }
      },
    );

    setBorrowTokens(sortedList);
  }

  return (
    <div className='flex-1'>
      <div className='flex items-center mb-8'>
        <h5 className='mr-1 text-base font-bold mr-1'>Borrow</h5>
        <InfoIcon text-white />
      </div>
      <TokenLabels isLend={false} sortFn={sortBorrowHandler} />
      {borrowTokens.map((info, i) => {
        return (
          <Token
            key={i}
            name={info.name}
            APY={info.APY}
            rewardsAPR={info.rewardsAPR}
            totalAmount={info.totalAmount}
            href={info.href}
          />
        );
      })}
    </div>
  );
};

type Props = {
  borrowTokensInitial: TokenType[];
};

export default Lend;
