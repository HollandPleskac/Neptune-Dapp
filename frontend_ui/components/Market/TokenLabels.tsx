const TokenLabels: React.FC<{ isLend: boolean }> = (props) => {
  return (
    <div className='flex mb-4'>
      <h4 className='w-3/12 mr-6 text-sm text-gray-faded'>Token</h4>
      <h4 className='w-2/12 text-sm text-gray-faded'>
        {props.isLend ? 'Lend' : 'Borrow'} APY
      </h4>
      <h4 className='flex-1 text-sm text-gray-faded'>Rewards APR</h4>
      <h4 className='flex justify-end mr-6 text-sm text-gray-faded'>
        Total {props.isLend ? 'Lent' : 'Borrowed'}
      </h4>
    </div>
  );
};
export default TokenLabels;
