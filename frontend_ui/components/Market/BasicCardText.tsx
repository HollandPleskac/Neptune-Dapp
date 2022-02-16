import InfoIcon from '../../assets/InfoIcon';

const BasicCardText: React.FC<{
  labelText: string;
  value: string;
  valueLabel?: string;
  marginTop?: string;
}> = (props) => {
  return (
    <>
      <div className={`flex items-center mb-3 ${props.marginTop ?? ''}`}>
        <h5 className="text-xs mr-1">{props.labelText}</h5>
        <InfoIcon text-white />
      </div>
      <div className="flex">
        <h4 className="text-2xl py-0">{props.value}</h4>
        {props.valueLabel && (
          <h5 className="text-14px align-top ml-1">{props.valueLabel}</h5>
        )}
      </div>
    </>
  );
};

export default BasicCardText;
