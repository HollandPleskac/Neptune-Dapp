import cx from 'classnames';
import Image from 'next/image';
import SolLogo from 'public/sol.png';
import InfoIcon from 'assets/InfoIcon';

const TopStats = () => {
  const detailsWithSmallHeading = [
    {
      heading: 'Reserve Factor',
      detail: '20%',
    },
    {
      heading: 'Utilization Rate',
      detail: '42.13%',
    },
    {
      heading: 'Used as Collateral',
      detail: 'Yes',
      detailColor: 'text-green-normal',
      withIcon: true,
    },
    {
      heading: 'Liquidation Penalty',
      detail: '10%',
      withIcon: true,
    },
  ];
  return (
    <div className='flex justify-between w-full'>
      <div className='flex'>
        <Image
          src={SolLogo}
          alt='solana'
          width={40}
          height={40}
          layout='fixed'
        />
        <div className='flex flex-col ml-3'>
          <p className='font-bold text-base leading-5 mb-1'>SOL</p>
          <p className='text-xs opacity-50 whitespace-nowrap leading-3 font-medium'>
            Price: $184.04
          </p>
        </div>
      </div>
      {detailsWithSmallHeading.map((detail, i) => (
        <div key={i} className='flex flex-col'>
          <div className='text-xs leading-3 font-medium mb-2'>
            <span className='opacity-50'>{detail.heading}</span>
            <span className='ml-1 inline-block'>
              {detail.withIcon && <InfoIcon className='text-white' />}
            </span>
          </div>
          <p
            className={cx(
              'font-bold text-base leading-5',
              detail.detailColor ?? '',
            )}
          >
            {detail.detail}
          </p>
        </div>
      ))}
    </div>
  );
};

export default TopStats;
