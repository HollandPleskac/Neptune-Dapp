import type { NextPage, GetStaticProps } from 'next';
import Navbar from '../components/common/Navbar';
import Card1 from '../components/Market/Card1';
import Card2 from '../components/Market/Card2';
import Card3 from '../components/Market/Card3';
import Card4 from '../components/Market/Card4';
import Lend from '../components/Market/Lend';
import Borrow from '../components/Market/Borrow';

const Lending: NextPage<Props> = ({
  lendTokensInitial,
  borrowTokensInitial,
}: Props) => {
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
          <Lend lendTokensInitial={lendTokensInitial} />
          <Borrow borrowTokensInitial={borrowTokensInitial} />
        </div>
      </div>
    </div>
  );
};

type Props = {
  lendTokensInitial: TokenType[];
  borrowTokensInitial: TokenType[];
};

export const getStaticProps: GetStaticProps = () => {
  const dummyLendTokens: TokenType[] = [
    {
      name: 'SOL',
      APY: '5%',
      rewardsAPR: '2% - 6%',
      totalAmount: '$3,456,069',
      href: '/lend-borrow/sol/lend',
    },
    {
      name: 'USDC',
      APY: '2%',
      rewardsAPR: '1.2% - 5.3%',
      totalAmount: '$34,456,069',
      href: '/lend-borrow/usdc/lend',
    },
    {
      name: 'NEP',
      APY: '1.4%',
      rewardsAPR: '2.3% - 33.53%',
      totalAmount: '$656,069',
      href: '/lend-borrow/nep/lend',
    },
  ];

  const dummyBorrowTokens: TokenType[] = [
    {
      name: 'SOL',
      APY: '-11.23%',
      rewardsAPR: '2% - 5.53%',
      totalAmount: '$23,456,000',
      href: '/lend-borrow/sol/lend',
    },
    {
      name: 'USDC',
      APY: '-5.02%',
      rewardsAPR: '1% - 3.21%',
      totalAmount: '$34,456,069',
      href: '/lend-borrow/usdc/lend',
    },
    {
      name: 'NEP',
      APY: '-4.5%',
      rewardsAPR: '2.3% - 33.53%',
      totalAmount: '$656,069',
      href: '/lend-borrow/nep/lend',
    },
  ];
  return {
    props: {
      lendTokensInitial: dummyLendTokens,
      borrowTokensInitial: dummyBorrowTokens,
    },
  };
};

export default Lending;
