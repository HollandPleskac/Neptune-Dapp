type Props = {
  color: string;
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
    <path d='M8 4L4 0L0 4H8Z' className={props.color} />
  </svg>
);

export default SvgComponent;
