import DescendingSortArrow from 'assets/DescendingSortArrow';
import AscendingSortArrow from 'assets/AscendingSortArrow';

const Label = ({ name, widthClasses, field, sortFn, sortInfo }: Props) => {
  let ascArrowColor: string;
  let descArrowColor: string;

  if (sortInfo.lastSortedField !== field) {
    ascArrowColor = 'fill-gray-fadedMore';
    descArrowColor = 'fill-gray-fadedMore';
  } else if (sortInfo.order === 'asc') {
    ascArrowColor = 'fill-white';
    descArrowColor = 'fill-gray-fadedMore';
  } else {
    descArrowColor = 'fill-white';
    ascArrowColor = 'fill-gray-fadedMore';
  }

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
          <AscendingSortArrow color={ascArrowColor} className='mb-[0.125rem]' />
          <DescendingSortArrow color={descArrowColor} />
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
  sortInfo: SortInformation;
};

export default Label;
