import { RichText } from './RichText';

interface PageHeroProps {
  title: string;
  text: string;
}

// Info-page hero (Contact, FAQ): the brand-blue gradient band with soft light circles, a large
// title and the intro line; rounded bottom-right corner as on the live site.
export function PageHero({ title, text }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-br-[60px] bg-[linear-gradient(135deg,#061a45_0%,#0142aa_55%,#1e88e5_100%)] lg:rounded-br-[150px]">
      <span aria-hidden="true" className="absolute -right-[80px] -top-[120px] size-[380px] rounded-full bg-white/[0.07]" />
      <span aria-hidden="true" className="absolute bottom-[-140px] left-[35%] size-[300px] rounded-full bg-white/[0.05]" />
      <div className="relative mx-auto max-w-[1240px] px-[20px] pb-[50px] pt-[56px] lg:pb-[80px] lg:pt-[96px]">
        <h1 className="font-ui text-[32px] font-bold leading-[1.2] tracking-tight text-white lg:text-[48px]">{title}</h1>
        <p className="mt-[14px] max-w-[620px] font-ui text-[15px] leading-[1.6] text-white/85 lg:text-[17px]">
          <RichText text={text} />
        </p>
      </div>
    </section>
  );
}
