type Props = {
  [key: string]: any;
};
const SvgComponent = (props: Props) => (
  <svg
    width='10'
    height='7'
    viewBox='0 0 10 7'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    {...props}
  >
    <path
      d='M1 1L5 5L9 1'
      stroke='white'
      stroke-width='2'
      stroke-linecap='round'
    />
  </svg>
);

export default SvgComponent;
