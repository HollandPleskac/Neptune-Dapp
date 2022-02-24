import DescendingSortArrow from 'assets/DescendingSortArrow';
import AscendingSortArrow from 'assets/AscendingSortArrow';

const Label = ({ name, widthClasses, field, sortFn }: Props) => {
  return (
    <div className={`flex items-center ${widthClasses}`}>
      <div
        className='flex items-center cursor-pointer'
        onClick={() => {
          sortFn(field);
        }}
      >
        <h4 className='mr-3 text-sm text-gray-faded'>{name}</h4>
        <div>
          <AscendingSortArrow className='mb-[0.125rem]' />
          <DescendingSortArrow />
        </div>
      </div>
    </div>
  );
};

type Props = {
  name: string;
  widthClasses: string;
  field: string;
  sortFn: (field: string) => void;
};

export default Label;
