import { useState } from 'react';
import InfoIcon from '../../assets/InfoIcon';
import TokenLabels from './TokenLabels';
import Token from './Token';
import sortTokens from 'utils/sortTokens';

const Lend = ({ borrowTokensInitial }: Props) => {
  const [borrowTokens, setBorrowTokens] =
    useState<TokenType[]>(borrowTokensInitial);
  const [sortBorrowInfo, setBorrowSortInfo] = useState<SortInformation>({
    lastSortedField: null,
    order: null,
  });

  function sortBorrowHandler(field: string) {
    const { sortedList, sortInfo } = sortTokens(
      borrowTokens,
      field,
      sortBorrowInfo,
    );
    setBorrowSortInfo(sortInfo);
    setBorrowTokens(sortedList);
  }

  return (
    <div className='flex-1'>
      <div className='flex items-center mb-8'>
        <h5 className='mr-1 text-base font-bold'>Borrow</h5>
        <InfoIcon text-white />
      </div>
      <TokenLabels
        isLend={false}
        sortFn={sortBorrowHandler}
        sortInfo={sortBorrowInfo}
      />
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
