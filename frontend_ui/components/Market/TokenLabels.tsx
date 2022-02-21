const TokenLabels = ({ isLend, sortFn }: Props) => {
  return (
    <div className='flex mb-4'>
      <h4
        className='w-3/12 mr-6 text-sm text-gray-faded'
        onClick={() => {
          sortFn('name');
        }}
      >
        Token
      </h4>
      <h4
        className='w-2/12 text-sm text-gray-faded'
        onClick={() => {
          sortFn('APY');
        }}
      >
        {isLend ? 'Lend' : 'Borrow'} APY
      </h4>
      <h4
        className='flex-1 text-sm text-gray-faded'
        onClick={() => {
          sortFn('rewardsAPR');
        }}
      >
        Rewards APR
      </h4>
      <h4
        className='flex justify-end mr-6 text-sm text-gray-faded'
        onClick={() => {
          sortFn('totalAmount');
        }}
      >
        Total {isLend ? 'Lent' : 'Borrowed'}
      </h4>
    </div>
  );
};

type Props = {
  isLend: boolean;
  sortFn: (field: string) => void;
};

export default TokenLabels;
