const TokenLabels: React.FC<{ isLend: boolean }> = (props) => {
  return (
    <div className="flex mb-3">
      <h4 className="w-3/12 text-xs mr-5">Token</h4>
      <h4 className="w-2/12 text-xs">{props.isLend ? 'Lend' : 'Borrow'} APY</h4>
      <h4 className="flex-1 text-xs">Rewards APR</h4>
      <h4 className="flex justify-end mr-5 text-xs">
        Total {props.isLend ? 'Lent' : 'Borrowed'}
      </h4>
    </div>
  );
};
export default TokenLabels;
