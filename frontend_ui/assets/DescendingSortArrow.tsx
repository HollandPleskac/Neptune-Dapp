type Props = {
  [key: string]: any;
};
const SvgComponent = (props: Props) => (
  <svg
    width='8'
    height='4'
    viewBox='0 0 8 4'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    {...props}
  >
    <path d='M4 4L8 0H0L4 4Z' fill='white' />
  </svg>
);

export default SvgComponent;
