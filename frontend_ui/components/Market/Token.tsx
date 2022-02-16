const Token: React.FC<{
  name: string;
  lendAPY: string;
  rewardsAPR: string;
  totalLent: string;
}> = (props) => {
  return (
    <div className="flex bg-dark-secondary py-6 mb-4 rounded-2xl">
      <div className="bg-red-400f w-3/12 ml-6">ICON {props.name}</div>
      <div className="bg-blue-400f w-2/12">{props.lendAPY}</div>
      <div className="bg-yellow-400f flex-1">{props.rewardsAPR}</div>
      <div className="bg-purple-400f flex justify-end mr-6">
        {props.totalLent}
      </div>
    </div>
  );
};
export default Token;
