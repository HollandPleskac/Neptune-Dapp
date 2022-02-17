const Token: React.FC<{
  name: string;
  lendAPY: string;
  rewardsAPR: string;
  totalLent: string;
}> = (props) => {
  return (
    <div className="flex bg-dark-secondary py-5 mb-5 rounded-2xl">
      <div className="text-sm w-3/12 ml-5">ICON {props.name}</div>
      <div className="text-sm w-2/12">{props.lendAPY}</div>
      <div className="text-sm flex-1">{props.rewardsAPR}</div>
      <div className="text-sm flex justify-end mr-5">{props.totalLent}</div>
    </div>
  );
};
export default Token;
