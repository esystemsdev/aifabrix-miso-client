import svgPaths from "./svg-jegso7mdop";
import { imgGroup } from "./svg-idv4u";

export default function Favicon() {
  return (
    <div className="relative size-full" data-name="favicon 1">
      <div className="absolute contents inset-0" data-name="Clip path group">
        <div className="absolute inset-[0_0.5%_0_0] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[0px] mask-size-[75px_70px]" data-name="Group" style={{ maskImage: `url('${imgGroup}')` }}>
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 75 70">
            <g id="Group">
              <path d={svgPaths.p5723880} fill="var(--fill-0, #111827)" id="Vector" />
              <path d={svgPaths.p18cc100} fill="var(--fill-0, #111827)" id="Vector_2" />
              <path d={svgPaths.p2888f670} fill="var(--fill-0, #0062FF)" id="Vector_3" />
              <path d={svgPaths.p3d0c8dc0} fill="var(--fill-0, #0062FF)" id="Vector_4" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}