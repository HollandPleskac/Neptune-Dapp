import type { NextPage } from 'next';
import Navbar from '../components/common/Navbar';
import Card1 from '../components/Market/Card1';
import Card2 from '../components/Market/Card2';
import Card3 from '../components/Market/Card3';
import Card4 from '../components/Market/Card4';
import TokenLabels from '../components/Market/TokenLabels';
import Token from '../components/Market/Token';
import InfoIcon from '../assets/InfoIcon';

const Lending: NextPage = () => {
  const lendTokens = [
    {
      name: 'SOL',
      lendAPY: '5%',
      rewardsAPR: '2% - 6%',
      totalLent: '$3,456,069',
    },
    {
      name: 'USDC',
      lendAPY: '2%',
      rewardsAPR: '1.2% - 5.3%',
      totalLent: '$34,456,069',
    },
    {
      name: 'NEP',
      lendAPY: '1.4%',
      rewardsAPR: '2.3% - 33.53%',
      totalLent: '$656,069',
    },
  ];

  const borrowTokens = [
    {
      name: 'SOL',
      lendAPY: '-11.23%',
      rewardsAPR: '2% - 5.53%',
      totalLent: '$23,456,000',
    },
    {
      name: 'USDC',
      lendAPY: '-5.02%',
      rewardsAPR: '1% - 3.21%',
      totalLent: '$34,456,069',
    },
    {
      name: 'NEP',
      lendAPY: '-4.5%',
      rewardsAPR: '2.3% - 33.53%',
      totalLent: '$656,069',
    },
  ];

  return (
    <div className='bg-dark-primary h-auto'>
      <div className='w-body mx-auto'>
        <Navbar />
        <h2 className='mb-8 text-2xl font-bold'>Lend & Borrow</h2>
        <div className='flex justify-between'>
          <Card1 />
          <Card2 />
          <Card3 />
          <Card4 />
        </div>
        <h2 className='mt-10 mb-8 text-2xl font-bold'>Markets</h2>
        <div className='flex gap-4'>
          <div className='flex-1'>
            <div className='flex items-center mb-8'>
              <h5 className='mr-1 text-base font-bold'>Lend</h5>
              <InfoIcon text-white />
            </div>
            <TokenLabels isLend={true} />
            {lendTokens.map((info, i) => {
              return (
                <Token
                  key={i}
                  name={info.name}
                  lendAPY={info.lendAPY}
                  rewardsAPR={info.rewardsAPR}
                  totalLent={info.totalLent}
                />
              );
            })}
          </div>
          <div className='flex-1'>
            <div className='flex items-center mb-8'>
              <h5 className='mr-1text-base font-bold mr-1'>Borrow</h5>
              <InfoIcon text-white />
            </div>
            <TokenLabels isLend={false} />
            {borrowTokens.map((info, i) => {
              return (
                <Token
                  key={i}
                  name={info.name}
                  lendAPY={info.lendAPY}
                  rewardsAPR={info.rewardsAPR}
                  totalLent={info.totalLent}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lending;
