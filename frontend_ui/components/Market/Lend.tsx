import { useState } from 'react';
import InfoIcon from '../../assets/InfoIcon';
import TokenLabels from './TokenLabels';
import Token from './Token';
import sortTokens from 'utils/sortTokens';

const Lend = ({ lendTokensInitial }: Props) => {
  const [lendTokens, setLendTokens] = useState<TokenType[]>(lendTokensInitial);
  const [lendSortInfo, setLendSortInfo] = useState<SortInformation>({
    lastSortedField: null,
    order: null,
  });

  function sortLendHandler(field: string) {
    const { sortedList, sortInfo } = sortTokens(
      lendTokens,
      field,
      lendSortInfo,
    );
    setLendSortInfo(sortInfo);
    setLendTokens(sortedList);
  }

  return (
    <div className='flex-1'>
      <div className='flex items-center mb-8'>
        <h5 className='mr-1 text-base font-bold'>Lend</h5>
        <InfoIcon text-white />
      </div>
      <TokenLabels isLend={true} sortFn={sortLendHandler} sortInfo={lendSortInfo} />
      {lendTokens.map((info, i) => {
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
  lendTokensInitial: TokenType[];
};

export default Lend;
