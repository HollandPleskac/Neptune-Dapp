const TokenLabels: React.FC<{ isLend: boolean }> = (props) => {
  return (
    <div className='flex mb-4'>
      <h4 className='w-3/12 text-sm mr-6'>Token</h4>
      <h4 className='w-2/12 text-sm'>{props.isLend ? 'Lend' : 'Borrow'} APY</h4>
      <h4 className='flex-1 text-sm'>Rewards APR</h4>
      <h4 className='flex justify-end mr-6 text-sm'>
        Total {props.isLend ? 'Lent' : 'Borrowed'}
      </h4>
    </div>
  );
};
export default TokenLabels;
