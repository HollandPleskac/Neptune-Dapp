import NeptuneLogo from 'assets/NeptuneLogo';
import React from 'react';
import Link from 'next/link';

const Token = ({ name, APY, rewardsAPR, totalAmount, href }: Props) => {
  return (
    <Link href={href}>
      <a className='flex items-center bg-dark-secondary py-6 mb-4 rounded-2xl cursor-pointer'>
        <div className='flex items-center text-sm font-bold w-[164px] pl-6'>
          <div className='w-8 h-8 bg-blue-600 rounded-full'></div>
          <h3 className='ml-4'>{name}</h3>
        </div>
        <div className='w-[116px] text-sm font-bold'>{APY}</div>
        <div className='flex-1 flex items-center text-sm font-bold'>
          {rewardsAPR}
          {/* <div className='w-4 h-4 ml-1 bg-blue-600 rounded-full mr-2'></div> */}
          <NeptuneLogo className='w-4 h-4 ml-1' />
        </div>
        <div className='flex justify-end mr-6 text-sm font-bold'>
          {totalAmount}
        </div>
      </a>
    </Link>
  );
};

type Props = {
  name: string;
  APY: string;
  rewardsAPR: string;
  totalAmount: string;
  href: string;
};

export default Token;
