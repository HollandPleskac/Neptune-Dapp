const TokenLabels: React.FC<{ isLend: boolean }> = (props) => {
  return (
    <div className="flex mb-4">
      <h4 className="w-3/12 text-14px mr-6">Token</h4>
      <h4 className="w-2/12 text-14px">
        {props.isLend ? 'Lend' : 'Borrow'} APY
      </h4>
      <h4 className="flex-1 text-14px">Rewards APR</h4>
      <h4 className="flex justify-end mr-6 text-14px">
        Total {props.isLend ? 'Lent' : 'Borrowed'}
      </h4>
    </div>
  );
};
export default TokenLabels;
