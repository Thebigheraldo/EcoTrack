// src/utils/questions.js

// =====================
// HELPERS
// =====================

const q = (
  category,
  id,
  question,
  guidance,
  tags = [],
  critical = false,
  weight = undefined
) => ({
  category,
  id,
  question,
  guidance,
  tags,
  critical,
  weight,
});

const g = (notInPlace, informal, partial, implemented) => ({
  notInPlace,
  informal,
  partial,
  implemented,
});

const sectorAlias = {
  "Agriculture/Food": "AgricultureFood",
  "Textile/Fashion": "TextileFashion",
};

const pillarMap = {
  Environmental: "E",
  Social: "S",
  Governance: "G",
};

export const ANSWER_TO_MATURITY = {
  "Not in place": "notInPlace",
  "Informal / ad hoc": "informal",
  "Informal/ad hoc": "informal",
  "Partially structured": "partial",
  "Implemented & documented": "implemented",
  "Implemented and documented": "implemented",
  "Advanced / best practice": "advanced",
  "Advanced/best practice": "advanced",
};

export const MATURITY_PRIORITY = {
  notInPlace: 1,
  informal: 2,
  partial: 3,
  implemented: 4,
  advanced: 5,
};

function normalizeTags(arr) {
  return [...new Set((arr || []).map((t) => String(t).toLowerCase().trim()).filter(Boolean))];
}

function hasAny(tagSet, arr) {
  for (const a of arr) {
    if (tagSet.has(a)) return true;
  }
  return false;
}

function inferWeight({ pillar, tags, critical }) {
  if (critical) return 3;

  const t = new Set(tags || []);

  if (pillar === "E") {
    if (hasAny(t, ["metrics", "scope2", "energy", "energy-efficiency"])) return 3;
    if (hasAny(t, ["water", "waste", "circularity", "chemicals", "biodiversity", "logistics"])) return 2;
    return 1;
  }

  if (pillar === "S") {
    if (hasAny(t, ["health-safety", "human-rights"])) return 3;
    if (hasAny(t, ["people", "training"])) return 2;
    return 1;
  }

  if (pillar === "G") {
    if (hasAny(t, ["ethics", "policy", "governance", "foundations"])) return 3;
    if (hasAny(t, ["transparency", "procurement", "metrics"])) return 2;
    return 1;
  }

  return 1;
}

export function getMaturityKey(answer) {
  if (answer == null) return null;

  // direct string answers
  if (typeof answer === "string") {
    const trimmed = answer.trim();
    if (ANSWER_TO_MATURITY[trimmed]) return ANSWER_TO_MATURITY[trimmed];

    const lower = trimmed.toLowerCase();

    if (lower === "yes" || lower === "yes (fully in place)") return "advanced";
    if (lower === "no" || lower === "no (not in place)") return "notInPlace";
    if (
      lower === "partial" ||
      lower === "partially structured" ||
      lower === "partially implemented"
    ) {
      return "partial";
    }
    if (lower === "unknown" || lower === "n/a" || lower === "na") {
      return "notInPlace";
    }

    return null;
  }

  // numeric answers
  if (typeof answer === "number") {
    const s = Math.max(0, Math.min(4, answer));
    if (s === 0) return "notInPlace";
    if (s === 1) return "informal";
    if (s === 2) return "partial";
    if (s === 3) return "implemented";
    if (s === 4) return "advanced";
    return null;
  }

  // object answers like { score, label }
  if (typeof answer === "object") {
    const label =
      answer.label ||
      answer.answerLabel ||
      answer.answer ||
      "";

    const fromLabel = getMaturityKey(label);
    if (fromLabel) return fromLabel;

    const score =
      typeof answer.score === "number"
        ? answer.score
        : typeof answer.answerScore === "number"
        ? answer.answerScore
        : typeof answer.numericScore === "number"
        ? answer.numericScore
        : null;

    if (typeof score === "number") {
      return getMaturityKey(score);
    }
  }

  return null;
}

export function getSuggestionForAnswer(questionObj, answer) {
  const maturityKey = getMaturityKey(answer);
  if (!maturityKey || maturityKey === "advanced") return null;
  return questionObj?.guidance?.[maturityKey] || null;
}

// =====================
// QUESTIONS DATASET
// =====================

const data = {
  Manufacturing: [
    q(
      "Environmental",
      "manu_carbon_footprint",
      "Do you track and report your carbon footprint?",
      g(
        "Map the main emission sources across operations, collect basic fuel and electricity data, and calculate an initial footprint even if the first version is simple.",
        "Move from occasional estimates to a defined carbon accounting process with clear boundaries, data owners, and a yearly update cycle.",
        "Expand the inventory to cover all relevant sites and material sources, improve data quality, and use the results to identify the biggest hotspots.",
        "Strengthen the process by linking footprint results to targets, capex planning, supplier dialogue, and management review."
      ),
      ["metrics", "transparency", "energy"],
      false
    ),
    q(
      "Environmental",
      "manu_emission_targets",
      "Have you set emission reduction targets in line with global climate goals?",
      g(
        "Set a first reduction objective based on your main emission sources and define a baseline year so the company has a clear direction.",
        "Turn broad intentions into formal targets with scope, timeline, and internal ownership instead of relying on general statements.",
        "Refine targets by separating short- and medium-term milestones and aligning them with realistic operational reduction measures.",
        "Improve the target system by reviewing progress regularly, updating assumptions, and linking it to investment and procurement decisions."
      ),
      ["metrics", "policy", "energy"],
      true
    ),
    q(
      "Environmental",
      "manu_renewable_energy",
      "Do you use renewable energy sources in your operations?",
      g(
        "Review current electricity contracts and identify whether certified renewable electricity or on-site renewable options are feasible for your sites.",
        "Move from isolated renewable purchases to a formal sourcing approach with documented coverage, supplier evidence, and responsibilities.",
        "Increase renewable energy coverage across more operations and verify claims with contract or certificate records.",
        "Strengthen the approach by integrating renewable sourcing into your energy strategy, emissions roadmap, and site planning."
      ),
      ["energy", "scope2"],
      true
    ),
    q(
      "Environmental",
      "manu_energy_efficiency_program",
      "Have you implemented an energy efficiency program?",
      g(
        "Identify the most energy-intensive equipment or processes and create a basic improvement list focused on quick operational wins.",
        "Formalize energy efficiency efforts with named owners, a review routine, and criteria for selecting priority actions.",
        "Track savings from implemented measures, broaden the programme across sites or production lines, and standardize follow-up.",
        "Improve the programme by linking efficiency actions to maintenance, investment planning, and measurable reduction goals."
      ),
      ["energy-efficiency"],
      false
    ),
    q(
      "Environmental",
      "manu_water_tracking",
      "Do you track and optimize water usage in your production?",
      g(
        "Measure water use at facility level, identify the processes with the highest consumption, and establish a basic baseline.",
        "Move from occasional checks to a routine water review with responsibilities, frequency, and simple performance indicators.",
        "Improve control by tracking water at process level where possible and using the data to identify leaks, waste, or reuse opportunities.",
        "Strengthen the practice by linking water performance to reduction goals, operational planning, and site risk assessment."
      ),
      ["water", "metrics"],
      false
    ),
    q(
      "Environmental",
      "manu_waste_recycling",
      "How do you manage waste and recycling in your operations?",
      g(
        "Identify the main waste streams, separate them where practical, and begin recording volumes and disposal routes.",
        "Formalize waste handling with documented categories, assigned responsibilities, and recurring checks on segregation and contractor performance.",
        "Review waste trends regularly and focus on reducing avoidable waste at source rather than only improving disposal.",
        "Advance the system through waste reduction targets, contractor performance review, and circular recovery opportunities."
      ),
      ["waste", "circularity"],
      false
    ),
    q(
      "Environmental",
      "manu_circular_economy",
      "Do you follow circular economy principles?",
      g(
        "Identify where materials, packaging, or production outputs can be reduced, reused, repaired, or recycled more effectively.",
        "Move from isolated circular actions to a defined approach with scope, ownership, and priority areas.",
        "Apply circular principles more consistently across product design, material use, packaging, or process flows and track the benefits.",
        "Strengthen circularity by embedding it into sourcing, product development, customer take-back, and supplier collaboration."
      ),
      ["circularity"],
      false
    ),
    q(
      "Environmental",
      "manu_hazardous_materials",
      "Do you reduce hazardous materials in production?",
      g(
        "Create an inventory of hazardous substances used in production and identify where safer alternatives may exist.",
        "Formalize chemical reduction efforts with substitution criteria, approval controls, and clearer responsibilities.",
        "Track progress on reducing higher-risk substances and extend controls to purchasing and production planning.",
        "Strengthen the system by linking chemical management to supplier requirements, training, and periodic risk review."
      ),
      ["chemicals"],
      false
    ),
    q(
      "Environmental",
      "manu_supply_chain_env_risks",
      "Have you assessed your supply chain for environmental risks?",
      g(
        "Identify the suppliers, materials, or outsourced activities with the highest potential environmental impact and define simple screening criteria.",
        "Move from occasional supplier checks to a repeatable environmental risk review process with documented evidence.",
        "Expand assessment coverage and differentiate between lower- and higher-risk suppliers based on product, geography, or material type.",
        "Strengthen the approach by integrating environmental risk results into purchasing decisions, supplier engagement, and corrective action tracking."
      ),
      ["procurement", "governance"],
      false
    ),
    q(
      "Environmental",
      "manu_supplier_env_certifications",
      "Do your suppliers meet environmental certifications?",
      g(
        "Identify which supplier categories would benefit most from recognized environmental certifications and request basic evidence from key suppliers.",
        "Formalize certification checks in supplier onboarding or review rather than asking for documents only when needed.",
        "Increase coverage among critical suppliers and verify whether certifications remain valid and relevant to supplied goods or services.",
        "Improve the process by combining certification review with broader supplier ESG performance monitoring."
      ),
      ["procurement", "governance"],
      false
    ),
    q(
      "Social",
      "manu_fair_wages_conditions",
      "Do you have policies ensuring fair wages and working conditions?",
      g(
        "Define minimum expectations on wages, hours, and working conditions and put them into a basic written policy.",
        "Move from unwritten practice to a formal policy with scope, ownership, and a method to check whether it is followed.",
        "Apply the policy more consistently across departments and contractor relationships and collect evidence of implementation.",
        "Strengthen the approach by reviewing outcomes, handling grievances effectively, and linking expectations to supplier and HR processes."
      ),
      ["people", "human-rights", "policy"],
      true
    ),
    q(
      "Social",
      "manu_health_safety_compliance",
      "Do you ensure health & safety compliance for employees?",
      g(
        "Identify the main workplace hazards, define minimum controls, and assign responsibility for incident and near-miss monitoring.",
        "Turn basic compliance into a documented safety system with procedures, training, and recurring checks.",
        "Improve consistency across shifts, teams, and sites and use incident trends to target preventive action.",
        "Strengthen the system by integrating safety performance into management review, contractor control, and continuous improvement."
      ),
      ["health-safety", "training"],
      true
    ),
    q(
      "Social",
      "manu_diversity_hiring",
      "Do you promote diversity and inclusion in hiring?",
      g(
        "Review current hiring practices and define a few realistic steps to reduce bias and widen candidate access.",
        "Formalize inclusion efforts through written hiring principles, clearer responsibilities, and more structured recruitment criteria.",
        "Track relevant recruitment indicators and identify where the process still produces uneven outcomes.",
        "Improve the approach by linking inclusion goals to leadership accountability, training, and periodic hiring review."
      ),
      ["people"],
      false
    ),
    q(
      "Social",
      "manu_supply_chain_social_impact",
      "Do you assess the social impact of your supply chain?",
      g(
        "Identify supplier categories or geographies where labor and human rights risks are more likely and define basic review criteria.",
        "Move from reactive checks to a repeatable supplier social assessment process with documentation and follow-up.",
        "Improve coverage of higher-risk suppliers and track whether concerns are actually corrected rather than only recorded.",
        "Strengthen the system by integrating social impact results into procurement decisions, audits, and remediation planning."
      ),
      ["human-rights", "procurement"],
      false
    ),
    q(
      "Social",
      "manu_employee_sustainability_training",
      "Do you train employees on sustainability?",
      g(
        "Identify the most relevant sustainability topics for your workforce and start with basic awareness sessions for the teams that matter most.",
        "Formalize training with defined audiences, timing, and simple records of completion rather than one-off communication.",
        "Tailor the content to job roles and check whether training is influencing actual day-to-day practices.",
        "Improve the programme by integrating refresher training, role-specific accountability, and management follow-up."
      ),
      ["training"],
      false
    ),
    q(
      "Social",
      "manu_local_communities",
      "Do you support local communities?",
      g(
        "Identify which local stakeholders are most affected by your operations and start with a few practical engagement or support actions.",
        "Move from occasional community support to a clearer approach with criteria, ownership, and basic documentation.",
        "Evaluate whether activities address real local needs and connect them more directly to your operational footprint.",
        "Strengthen the approach by setting priorities, tracking outcomes, and reviewing community feedback over time."
      ),
      ["people"],
      false
    ),
    q(
      "Governance",
      "manu_code_of_ethics",
      "Do you have a code of ethics for employees and suppliers?",
      g(
        "Create a basic code of ethics that sets minimum expectations on conduct, integrity, and responsible business behaviour.",
        "Move from a general statement to a formal code with approval, communication, and practical application rules.",
        "Make the code operational by linking it to onboarding, supplier communication, and escalation channels.",
        "Strengthen the system through regular review, training, supplier acknowledgement, and monitoring of breaches."
      ),
      ["ethics", "policy"],
      true
    ),
    q(
      "Governance",
      "manu_anti_corruption_program",
      "Do you have a compliance program for anti-corruption?",
      g(
        "Define basic anti-corruption rules for gifts, conflicts of interest, and third-party behaviour and communicate them internally.",
        "Formalize the programme with written procedures, responsibilities, and reporting channels instead of relying on assumptions.",
        "Increase effectiveness by training relevant teams, documenting checks, and focusing on higher-risk transactions or roles.",
        "Strengthen the programme by linking it to supplier controls, investigations, and management oversight."
      ),
      ["ethics", "policy"],
      false
    ),
    q(
      "Governance",
      "manu_esg_risk_strategy",
      "Do you integrate ESG risks into business strategy?",
      g(
        "Identify the ESG risks most likely to affect operations, costs, customers, or compliance and discuss them in planning decisions.",
        "Move from informal awareness to a defined process that includes ESG risks in strategic reviews and decision-making.",
        "Improve the process by ranking risks, assigning owners, and connecting them to business priorities and budgets.",
        "Strengthen integration by reviewing ESG risks regularly at leadership level and linking them to targets and action plans."
      ),
      ["governance", "foundations"],
      true
    ),
    q(
      "Governance",
      "manu_esg_responsible_person",
      "Is there an ESG responsible person in the company?",
      g(
        "Assign a clear person to coordinate ESG topics so responsibilities are not left fragmented or assumed.",
        "Clarify the role, reporting line, and minimum tasks so ESG coordination does not depend only on individual initiative.",
        "Support the role with cross-functional input, access to management, and a defined review rhythm.",
        "Strengthen the setup by embedding the role in formal governance, target tracking, and internal accountability."
      ),
      ["governance", "foundations"],
      false
    ),
  ],

  AgricultureFood: [
    q(
      "Environmental",
      "agri_farming_emissions",
      "Do you track greenhouse gas emissions from farming?",
      g(
        "Identify the main emission sources such as fuel, fertilizer use, livestock, or energy and create a first simple emissions baseline.",
        "Move from rough estimates to a structured annual calculation with clear boundaries and responsible data owners.",
        "Improve data quality by covering more relevant activities and using the results to identify the main reduction hotspots.",
        "Strengthen the process by linking emissions data to farm planning, supplier choices, and reduction targets."
      ),
      ["metrics", "energy"],
      false
    ),
    q(
      "Environmental",
      "agri_sustainable_farming",
      "Do you use sustainable farming practices?",
      g(
        "Identify a few priority practices such as soil protection, input reduction, crop rotation, or responsible water management and start applying them consistently.",
        "Move from isolated good practices to a defined sustainable farming approach with documented priorities and responsibilities.",
        "Broaden the use of sustainable practices across fields, crops, or suppliers and review whether they are reducing impacts.",
        "Strengthen the approach by integrating sustainable farming criteria into planning, training, and performance review."
      ),
      ["energy", "water", "biodiversity"],
      false
    ),
    q(
      "Environmental",
      "agri_water_conservation",
      "Have you implemented water conservation measures?",
      g(
        "Identify the highest water-use activities and begin with practical measures such as irrigation control, leak checks, or timing improvements.",
        "Formalize water conservation with responsibilities, monitoring, and clear actions rather than occasional efficiency efforts.",
        "Expand the measures across operations and track whether they are actually reducing water use or losses.",
        "Strengthen the programme by linking water-saving measures to site risk, crop planning, and performance targets."
      ),
      ["water"],
      false
    ),
    q(
      "Environmental",
      "agri_soil_deforestation",
      "Do you reduce soil degradation and deforestation?",
      g(
        "Identify where your activities or sourcing may affect soil health or land-use change and define minimum preventive practices.",
        "Move from general concern to a defined process for monitoring sensitive areas, sourcing risks, and field practices.",
        "Improve the approach by using clearer indicators and applying controls more consistently across suppliers or production areas.",
        "Strengthen the system by linking soil and land-use risk management to sourcing decisions, contracts, and farm planning."
      ),
      ["biodiversity", "procurement"],
      false
    ),
    q(
      "Environmental",
      "agri_sustainable_packaging",
      "Do you use biodegradable or recyclable packaging?",
      g(
        "Review current packaging materials and identify where recyclable or lower-impact alternatives are feasible.",
        "Move from occasional material changes to a packaging improvement plan with priorities, supplier input, and documented criteria.",
        "Increase coverage across product lines and check whether packaging choices improve recyclability or waste performance in practice.",
        "Strengthen the approach by integrating packaging decisions into product design, procurement, and customer communication."
      ),
      ["waste", "circularity"],
      false
    ),
    q(
      "Environmental",
      "agri_food_waste",
      "Do you reduce food waste in production?",
      g(
        "Identify where food losses occur most often in production, storage, or handling and start measuring them at a basic level.",
        "Formalize waste reduction efforts with responsibilities, recording methods, and recurring review of main causes.",
        "Target the largest waste drivers through process changes, handling improvements, or better planning and track results.",
        "Strengthen the system by linking food waste reduction to procurement, forecasting, and recovery or redistribution options."
      ),
      ["waste", "circularity"],
      false
    ),
    q(
      "Environmental",
      "agri_sustainable_sourcing",
      "Do you ensure sustainable sourcing of raw materials?",
      g(
        "Identify the raw materials with the highest environmental or social exposure and define minimum sourcing expectations.",
        "Move from informal supplier selection to a repeatable sustainable sourcing process with documented checks.",
        "Broaden supplier coverage and differentiate review depth based on material risk, geography, or sourcing volume.",
        "Strengthen the approach by linking sourcing decisions to audits, supplier development, and corrective actions."
      ),
      ["procurement"],
      false
    ),
    q(
      "Environmental",
      "agri_synthetic_pesticides",
      "Do you limit use of synthetic pesticides?",
      g(
        "Review which pesticides are used, where, and why, and identify opportunities to reduce dependency or substitute higher-risk products.",
        "Formalize pesticide management with documented approval criteria, usage controls, and responsibilities.",
        "Track reduction progress and improve consistency across crops, suppliers, or operators handling pesticide use.",
        "Strengthen the system by linking pesticide reduction to agronomic planning, supplier dialogue, and training."
      ),
      ["chemicals"],
      false
    ),
    q(
      "Environmental",
      "agri_biodiversity_impact",
      "Do you measure impact on biodiversity?",
      g(
        "Identify whether your farming or sourcing activities interact with sensitive habitats, land-use change, or species-related risks.",
        "Move from general awareness to a documented biodiversity review with defined locations, criteria, and ownership.",
        "Expand the assessment to higher-risk crops, sites, or suppliers and track the mitigation actions taken.",
        "Strengthen the process by linking biodiversity considerations to sourcing, farm practices, and land management decisions."
      ),
      ["biodiversity"],
      false
    ),
    q(
      "Environmental",
      "agri_offset_reforestation",
      "Do you participate in carbon offsetting or reforestation?",
      g(
        "Clarify whether offsetting or reforestation is relevant to your business and avoid using it as a substitute for direct reductions.",
        "Move from occasional support of projects to a documented approach with criteria for quality, credibility, and scope.",
        "Ensure projects are clearly linked to your strategy and supported by evidence rather than marketing claims.",
        "Strengthen the approach by prioritizing direct reductions first and using any offset or restoration activity transparently and cautiously."
      ),
      ["biodiversity", "transparency"],
      false
    ),
    q(
      "Social",
      "agri_fair_labor_policy",
      "Do you have fair labor policies for farm workers?",
      g(
        "Set minimum written expectations on wages, hours, treatment, and basic working conditions for farm workers.",
        "Move from verbal practice to a formal labor policy with scope, ownership, and checks for implementation.",
        "Apply the policy more consistently across seasonal, direct, and contracted labor and gather evidence of compliance.",
        "Strengthen the system by linking worker protections to grievance handling, supervision, and supplier or contractor control."
      ),
      ["people", "human-rights", "policy"],
      false
    ),
    q(
      "Social",
      "agri_safe_working_conditions",
      "Do you provide safe working conditions?",
      g(
        "Identify the main farm or food production hazards and define minimum controls, protective equipment, and responsibilities.",
        "Formalize safety management with procedures, training, and recurring checks rather than relying on experience alone.",
        "Improve consistency across teams and seasonal workers and use incident trends to strengthen preventive action.",
        "Strengthen the system through contractor control, refresher training, and management review of safety performance."
      ),
      ["health-safety", "training"],
      false
    ),
    q(
      "Social",
      "agri_human_rights_audit",
      "Do you audit human rights in the supply chain?",
      g(
        "Identify the suppliers or sourcing regions where human rights risks may be higher and define minimum review criteria.",
        "Move from reactive checks to a routine due diligence process with documented supplier evidence and follow-up.",
        "Expand assessment coverage and focus more deeply on the suppliers or categories with the greatest risk.",
        "Strengthen the process by tracking corrective actions, escalation, and procurement decisions linked to findings."
      ),
      ["human-rights", "procurement"],
      false
    ),
    q(
      "Social",
      "agri_smallholder_inclusion",
      "Are smallholder farmers included in sustainability programs?",
      g(
        "Identify whether smallholder farmers are part of your supply base and define a few practical ways to include them in support or training programmes.",
        "Move from ad hoc inclusion to a documented approach with criteria, communication, and responsibilities.",
        "Improve the programme by tailoring support to real farmer needs and tracking participation across the supply base.",
        "Strengthen the approach by integrating smallholder engagement into sourcing strategy, capacity building, and outcome review."
      ),
      ["people"],
      false
    ),
    q(
      "Social",
      "agri_fair_wages_supply_chain",
      "Do you ensure fair wages across your supply chain?",
      g(
        "Define minimum wage-related expectations for suppliers and identify where wage risks may be highest.",
        "Move from general supplier expectations to a documented review process with evidence and escalation rules.",
        "Improve oversight of higher-risk suppliers and check whether corrective actions are actually implemented.",
        "Strengthen the system by linking wage expectations to procurement decisions, audits, and supplier improvement plans."
      ),
      ["people", "human-rights"],
      false
    ),
    q(
      "Social",
      "agri_child_forced_labor_policy",
      "Do you have a policy against child and forced labor?",
      g(
        "Create a clear written policy prohibiting child labor and forced labor and communicate it internally and to suppliers.",
        "Move from policy existence to a defined process for supplier checks, reporting concerns, and escalation.",
        "Apply the policy more consistently in onboarding, contracts, and risk-based supplier review.",
        "Strengthen the system through training, remediation procedures, and regular monitoring of higher-risk sourcing chains."
      ),
      ["human-rights", "policy"],
      true
    ),
    q(
      "Governance",
      "agri_certifications",
      "Do you hold certifications like Fair Trade or Organic?",
      g(
        "Identify which certifications are actually relevant to your products, markets, or sourcing model before pursuing them.",
        "Move from informal interest to a planned certification path with scope, costs, responsibilities, and evidence requirements.",
        "Use certification more consistently across the product lines or suppliers where it adds real value and credibility.",
        "Strengthen the approach by combining certification with broader ESG controls rather than treating the label as sufficient by itself."
      ),
      ["transparency", "procurement"],
      false
    ),
    q(
      "Governance",
      "agri_supplier_due_diligence",
      "Do you perform ESG due diligence on suppliers?",
      g(
        "Identify key supplier risks and define a simple due diligence process focused on the most material categories first.",
        "Formalize supplier ESG due diligence with documentation, roles, evidence requirements, and review timing.",
        "Improve the process by expanding coverage, ranking suppliers by risk, and tracking follow-up actions.",
        "Strengthen the system by linking due diligence findings to sourcing decisions, contract terms, and supplier development."
      ),
      ["governance", "procurement"],
      false
    ),
    q(
      "Governance",
      "agri_food_safety_esg_laws",
      "Do you comply with EU food safety and ESG laws?",
      g(
        "Identify the laws and regulatory requirements that apply to your business and assign responsibility for monitoring them.",
        "Move from reactive compliance to a documented compliance register and periodic legal review process.",
        "Improve the system by checking implementation across sites, products, and suppliers instead of only tracking obligations centrally.",
        "Strengthen the approach by linking compliance review to management oversight, internal controls, and corrective actions."
      ),
      ["governance", "policy"],
      false
    ),
    q(
      "Governance",
      "agri_stakeholder_reporting",
      "Do you report sustainability data to stakeholders?",
      g(
        "Identify which sustainability topics and indicators matter most to customers, investors, or partners and begin collecting the basic data needed.",
        "Move from occasional disclosure to a structured reporting process with scope, ownership, and simple validation.",
        "Improve consistency and credibility by standardizing indicators and increasing the completeness of reported information.",
        "Strengthen the approach by aligning reporting with recognized expectations and using it to support management decisions."
      ),
      ["transparency"],
      false
    ),
  ],

  TextileFashion: [
    q(
      "Environmental",
      "textile_production_emissions",
      "Do you track and reduce CO₂ emissions in production?",
      g(
        "Map the main production-related emission sources such as energy, heat, and process-intensive activities and calculate a first baseline.",
        "Move from rough estimates to a structured emissions review with defined boundaries, owners, and periodic updates.",
        "Improve the inventory by expanding coverage to more facilities or production stages and using the data to target hotspots.",
        "Strengthen the process by connecting emissions performance to reduction targets, manufacturing decisions, and supplier engagement."
      ),
      ["metrics", "energy"],
      false
    ),
    q(
      "Environmental",
      "textile_sustainable_materials",
      "Do you use sustainable materials like organic cotton?",
      g(
        "Identify the materials with the highest impact and assess which lower-impact or certified alternatives are realistically available.",
        "Move from occasional material substitutions to a defined sourcing approach with criteria and supplier evidence.",
        "Increase the share of preferred materials in priority product lines and track progress against a material baseline.",
        "Strengthen the approach by integrating material choices into product development, sourcing strategy, and commercial planning."
      ),
      ["procurement", "circularity"],
      false
    ),
    q(
      "Environmental",
      "textile_dyeing_water_saving",
      "Do you implement water-saving techniques in dyeing?",
      g(
        "Identify the dyeing steps with the highest water use and start with practical controls, maintenance, or process improvements.",
        "Formalize water-saving efforts with responsibilities, monitoring, and review of performance at process level.",
        "Broaden the use of water-saving methods across lines or suppliers and track actual efficiency gains.",
        "Strengthen the system by linking dyeing water performance to investment, technology choice, and reduction targets."
      ),
      ["water"],
      false
    ),
    q(
      "Environmental",
      "textile_chemical_management",
      "Do you manage chemicals responsibly in production?",
      g(
        "Create an inventory of the key chemicals used and identify any substances that require tighter control or substitution.",
        "Move from basic handling to a documented chemical management system covering approval, storage, and use.",
        "Improve the process by expanding controls to suppliers or subcontractors and tracking substitution progress.",
        "Strengthen the approach by linking chemical management to product compliance, sourcing, training, and audit follow-up."
      ),
      ["chemicals"],
      false
    ),
    q(
      "Environmental",
      "textile_circular_fashion",
      "Do you follow circular fashion principles?",
      g(
        "Identify where products or materials can be designed for longer use, repair, reuse, recycling, or lower waste.",
        "Move from isolated circular ideas to a defined approach embedded in design and sourcing decisions.",
        "Apply circular principles across more products and track whether they reduce waste or improve material recovery.",
        "Strengthen the strategy by linking circularity to product design briefs, supplier engagement, and take-back opportunities."
      ),
      ["circularity"],
      false
    ),
    q(
      "Environmental",
      "textile_supplier_env_certifications",
      "Do your suppliers meet environmental certifications?",
      g(
        "Identify which supplier certifications are most relevant for your materials or processes and request evidence from key suppliers.",
        "Formalize certification checks in supplier onboarding and review rather than relying on occasional document collection.",
        "Increase coverage among the suppliers with the highest environmental relevance and verify certification validity regularly.",
        "Strengthen the system by combining certification review with broader supplier ESG monitoring and corrective actions."
      ),
      ["procurement", "governance"],
      false
    ),
    q(
      "Environmental",
      "textile_supply_chain_emissions",
      "Do you track supply chain carbon emissions?",
      g(
        "Identify the suppliers, materials, or outsourced stages that are likely to contribute most to your upstream footprint and collect basic data.",
        "Move from assumptions to a structured supplier emissions review with clear scope and evidence requirements.",
        "Improve the quality of upstream emissions data and focus on the categories that dominate total impact.",
        "Strengthen the approach by using supply chain carbon data in sourcing choices, target setting, and supplier engagement."
      ),
      ["metrics", "procurement"],
      false
    ),
    q(
      "Environmental",
      "textile_waste_targets",
      "Do you have targets for reducing textile waste?",
      g(
        "Measure the main sources of textile waste in cutting, production, returns, or unsold stock and define a first baseline.",
        "Move from general waste concerns to formal reduction targets with scope, timeline, and responsibility.",
        "Refine the targets by separating waste categories and focusing on the biggest drivers first.",
        "Strengthen the approach by linking waste reduction to design choices, inventory planning, and supplier collaboration."
      ),
      ["waste", "circularity", "metrics"],
      false
    ),
    q(
      "Social",
      "textile_factory_safety",
      "Do you ensure safe working conditions in factories?",
      g(
        "Identify the main safety risks in factories and define basic controls, equipment, and supervision requirements.",
        "Formalize safety management with documented procedures, training, and recurring inspections.",
        "Improve consistency across facilities and suppliers and use incident or audit findings to strengthen prevention.",
        "Strengthen the system through supplier follow-up, corrective action tracking, and leadership review of safety performance."
      ),
      ["health-safety"],
      false
    ),
    q(
      "Social",
      "textile_child_forced_labor",
      "Do you prohibit forced and child labor?",
      g(
        "Create a clear written prohibition and communicate it internally and to suppliers as a non-negotiable requirement.",
        "Move from policy presence to a defined supplier review process with screening, escalation, and response rules.",
        "Apply controls more consistently in higher-risk sourcing chains and track whether findings are corrected.",
        "Strengthen the system through training, remediation procedures, contract integration, and audit follow-up."
      ),
      ["human-rights", "policy"],
      true
    ),
    q(
      "Social",
      "textile_fair_wages",
      "Do you pay fair wages to garment workers?",
      g(
        "Define minimum wage-related expectations and identify where wage risks may exist in direct operations or sourcing.",
        "Move from general commitments to a documented review process with evidence requirements and supplier dialogue.",
        "Improve wage oversight among higher-risk facilities and track corrective actions over time.",
        "Strengthen the approach by linking wage expectations to sourcing decisions, audits, and supplier development plans."
      ),
      ["people", "human-rights"],
      false
    ),
    q(
      "Social",
      "textile_ethical_sourcing",
      "Are your products ethically sourced and produced?",
      g(
        "Identify the highest-risk sourcing stages and define minimum expectations for labor, safety, and responsible conduct.",
        "Move from broad ethical claims to a structured sourcing approach with supplier checks and documented evidence.",
        "Increase coverage across product lines and use findings to differentiate supplier risk and required actions.",
        "Strengthen the system by integrating ethical sourcing into procurement decisions, contracts, and performance reviews."
      ),
      ["procurement", "ethics"],
      false
    ),
    q(
      "Social",
      "textile_worker_wellbeing",
      "Do you improve worker well-being?",
      g(
        "Identify the main well-being issues affecting workers, such as workload, facilities, or support needs, and address the most basic gaps first.",
        "Move from informal concern to a documented well-being approach with responsibilities and practical measures.",
        "Use worker feedback and simple indicators to identify where support remains weak or uneven.",
        "Strengthen the approach by linking worker well-being to management review, leadership accountability, and continuous improvement."
      ),
      ["people"],
      false
    ),
    q(
      "Social",
      "textile_third_party_labor_audits",
      "Do you conduct third-party audits on labor conditions?",
      g(
        "Identify which facilities or suppliers would benefit most from independent labor reviews and define minimum expectations.",
        "Move from occasional audits to a planned risk-based audit approach with scope and follow-up responsibilities.",
        "Improve effectiveness by focusing audits on higher-risk suppliers and ensuring corrective actions are tracked to closure.",
        "Strengthen the system by combining audits with ongoing supplier engagement, worker voice, and escalation routes."
      ),
      ["human-rights", "procurement"],
      false
    ),
    q(
      "Social",
      "textile_diversity_leadership",
      "Do you promote diversity in leadership?",
      g(
        "Review leadership composition and recruitment practices and identify where barriers to diversity may exist.",
        "Move from general support to a defined inclusion approach with responsibilities and more structured promotion or hiring practices.",
        "Track relevant leadership indicators and address the stages where representation is weakest.",
        "Strengthen the approach by linking diversity progress to talent development, succession planning, and leadership review."
      ),
      ["people"],
      false
    ),
    q(
      "Governance",
      "textile_supply_chain_transparency",
      "Do you ensure supply chain transparency?",
      g(
        "Map the main supplier tiers and identify where visibility is weakest or most important for your business.",
        "Move from partial supplier knowledge to a structured transparency process with defined data requirements and ownership.",
        "Increase traceability for priority products, materials, or higher-risk suppliers and review data quality regularly.",
        "Strengthen the approach by linking transparency information to sourcing decisions, reporting, and risk management."
      ),
      ["transparency", "procurement"],
      false
    ),
    q(
      "Governance",
      "textile_esg_kpis",
      "Do you report ESG performance indicators?",
      g(
        "Select a basic set of ESG indicators relevant to your business and begin collecting consistent baseline data.",
        "Move from scattered data points to a defined KPI process with ownership, timing, and validation.",
        "Improve KPI coverage and consistency across operations and supply chain topics that matter most.",
        "Strengthen the approach by linking ESG KPIs to targets, management review, and external reporting."
      ),
      ["transparency", "metrics"],
      false
    ),
    q(
      "Governance",
      "textile_code_of_ethics",
      "Do you follow a business code of ethics?",
      g(
        "Create a code of ethics that defines acceptable conduct, integrity expectations, and key prohibited behaviours.",
        "Move from a general statement to an operational code with communication, ownership, and reporting channels.",
        "Link the code more clearly to onboarding, supplier expectations, and issue escalation procedures.",
        "Strengthen the framework through training, breach review, and management oversight."
      ),
      ["ethics", "policy"],
      false
    ),
    q(
      "Governance",
      "textile_esg_strategy_integration",
      "Do you integrate ESG risks in strategic decisions?",
      g(
        "Identify the ESG issues most likely to affect costs, sourcing, compliance, or brand risk and discuss them in planning.",
        "Move from informal awareness to a defined strategic review process that explicitly includes ESG risks.",
        "Improve the process by ranking risks, assigning owners, and linking them to budgets and action plans.",
        "Strengthen integration by reviewing ESG risks regularly at leadership level and embedding them in major decisions."
      ),
      ["governance", "foundations"],
      false
    ),
    q(
      "Governance",
      "textile_sustainability_education",
      "Do you educate employees and suppliers on sustainability?",
      g(
        "Identify the sustainability topics most relevant to internal teams and suppliers and start with basic targeted training.",
        "Move from occasional awareness to a documented education plan with defined audiences and simple completion records.",
        "Tailor content to role or supplier type and check whether the training improves actual practice.",
        "Strengthen the programme by linking training to expectations, corrective actions, and ongoing supplier development."
      ),
      ["training", "governance"],
      false
    ),
  ],

  Tech: [
    q(
      "Environmental",
      "tech_data_center_energy",
      "Do you track and reduce energy consumption in data centers?",
      g(
        "Collect baseline energy data for data centers or major IT infrastructure and identify the highest consumption drivers.",
        "Move from occasional energy checks to a structured monitoring process with ownership, boundaries, and review intervals.",
        "Improve the process by tracking energy performance trends and prioritizing operational or technical efficiency measures.",
        "Strengthen the approach by linking energy data to infrastructure planning, efficiency targets, and management review."
      ),
      ["energy", "metrics"],
      true
    ),
    q(
      "Environmental",
      "tech_renewable_energy",
      "Do you use renewable energy for operations?",
      g(
        "Review current electricity sourcing and assess whether certified renewable electricity or other lower-carbon options are feasible.",
        "Move from isolated renewable purchases to a defined sourcing approach with coverage, evidence, and responsibilities.",
        "Increase renewable energy coverage across offices, facilities, or key operations and verify the supporting evidence.",
        "Strengthen the approach by integrating renewable sourcing into energy strategy, emissions reduction, and procurement decisions."
      ),
      ["energy", "scope2"],
      false
    ),
    q(
      "Environmental",
      "tech_ewaste_targets",
      "Do you set targets for reducing electronic waste?",
      g(
        "Identify the main sources of electronic waste and measure them at a basic level so a target can be set on real data.",
        "Move from general intent to formal e-waste reduction targets with scope, ownership, and timeline.",
        "Refine targets by separating waste categories such as devices, peripherals, or returned equipment and tracking progress.",
        "Strengthen the approach by linking e-waste targets to procurement, repair, reuse, and asset retirement planning."
      ),
      ["waste", "metrics"],
      false
    ),
    q(
      "Environmental",
      "tech_takeback_recycling",
      "Do you run take-back or recycling programs?",
      g(
        "Identify which products or devices could realistically be collected, refurbished, or recycled and define a basic process.",
        "Move from isolated returns or disposals to a documented take-back or recycling programme with responsibilities and channels.",
        "Improve the programme by increasing participation, tracking volumes, and reviewing recovery outcomes.",
        "Strengthen the approach by linking take-back to product design, customer communication, and circular business opportunities."
      ),
      ["waste", "circularity"],
      false
    ),
    q(
      "Environmental",
      "tech_responsible_materials",
      "Do you ensure responsible sourcing of materials?",
      g(
        "Identify the materials and components with the highest ESG exposure and define minimum sourcing expectations for them.",
        "Move from informal supplier trust to a documented responsible sourcing process with evidence requirements.",
        "Improve the process by prioritizing higher-risk materials and increasing supplier coverage and follow-up.",
        "Strengthen the system by linking sourcing decisions to supplier performance, corrective actions, and design choices."
      ),
      ["procurement"],
      false
    ),
    q(
      "Environmental",
      "tech_supply_chain_carbon",
      "Do you track carbon emissions from your supply chain?",
      g(
        "Identify the suppliers, components, or outsourced activities most likely to drive upstream emissions and collect basic data.",
        "Move from rough assumptions to a structured upstream emissions review with defined boundaries and ownership.",
        "Improve the quality of the data and focus more closely on the supplier categories that dominate total impact.",
        "Strengthen the approach by using supply chain carbon insights in procurement, target setting, and supplier engagement."
      ),
      ["metrics", "procurement"],
      false
    ),
    q(
      "Environmental",
      "tech_energy_efficient_products",
      "Do you design energy-efficient products?",
      g(
        "Review product use patterns and identify where design changes could reduce energy consumption without undermining performance.",
        "Move from isolated efficiency improvements to a defined design criterion considered during product development.",
        "Track product efficiency more consistently across models or releases and use the results to prioritize design changes.",
        "Strengthen the approach by embedding energy efficiency into product requirements, testing, and development governance."
      ),
      ["energy-efficiency"],
      false
    ),
    q(
      "Environmental",
      "tech_low_water_production",
      "Do you ensure low water consumption in production?",
      g(
        "Identify where production or hardware-related processes use water and establish a simple baseline for the most relevant activities.",
        "Move from occasional checks to a structured review of water use, responsibilities, and reduction opportunities.",
        "Improve monitoring and target the process steps with the highest water intensity or greatest risk of inefficiency.",
        "Strengthen the approach by linking water performance to supplier management, process decisions, and improvement targets."
      ),
      ["water"],
      false
    ),
    q(
      "Social",
      "tech_labor_rights_supply_chain",
      "Do you protect labor rights in supply chains?",
      g(
        "Identify where labor rights risks may be higher in your supply chain and define minimum expectations for suppliers.",
        "Move from general supplier expectations to a documented due diligence process with checks, evidence, and escalation.",
        "Improve oversight of higher-risk suppliers and ensure follow-up actions are tracked rather than only reported.",
        "Strengthen the system by integrating labor rights findings into procurement decisions, audits, and supplier improvement plans."
      ),
      ["human-rights", "procurement"],
      false
    ),
    q(
      "Social",
      "tech_rare_minerals",
      "Do you ethically source rare minerals?",
      g(
        "Identify whether your products involve rare minerals or conflict-sensitive materials and map the most relevant sourcing chains.",
        "Move from supplier assurances to a documented due diligence process with clearer evidence and risk screening.",
        "Increase traceability and supplier coverage for the mineral categories with the highest ethical risk.",
        "Strengthen the approach by linking mineral sourcing due diligence to procurement decisions, reporting, and corrective action tracking."
      ),
      ["procurement", "human-rights"],
      false
    ),
    q(
      "Social",
      "tech_cybersecurity_policies",
      "Do you have cybersecurity policies to protect user data?",
      g(
        "Define basic written rules for data protection, access control, incident handling, and responsibility for cybersecurity topics.",
        "Move from technical habit to a formal cybersecurity policy framework with ownership and review frequency.",
        "Improve the system by checking whether policies are consistently implemented through controls, training, and monitoring.",
        "Strengthen the approach by integrating cybersecurity into governance, risk review, and continuous improvement."
      ),
      ["policy"],
      false
    ),
    q(
      "Social",
      "tech_digital_inclusion",
      "Do you promote digital inclusion?",
      g(
        "Identify who may be excluded from using your products or services and define a few practical inclusion improvements.",
        "Move from broad intent to a documented inclusion approach with responsibilities and target user groups.",
        "Use user feedback or product data to identify where access or usability barriers remain strongest.",
        "Strengthen the approach by integrating digital inclusion into product design, support, and business planning."
      ),
      ["people"],
      false
    ),
    q(
      "Social",
      "tech_safe_manufacturing",
      "Do you ensure safe conditions in manufacturing?",
      g(
        "Identify the main manufacturing-related hazards and define minimum controls, equipment, and supervision requirements.",
        "Formalize safety management with procedures, training, and recurring checks rather than relying only on experience.",
        "Improve consistency across internal operations or suppliers and use safety findings to strengthen prevention.",
        "Strengthen the system through contractor or supplier follow-up, corrective action closure, and leadership review."
      ),
      ["health-safety"],
      false
    ),
    q(
      "Social",
      "tech_gender_diversity_leadership",
      "Do you promote gender diversity in leadership?",
      g(
        "Review leadership composition and identify the stages where women are underrepresented in hiring, promotion, or retention.",
        "Move from general support to a structured inclusion approach with ownership and more transparent talent processes.",
        "Track relevant leadership diversity indicators and address the weakest points in the pipeline.",
        "Strengthen the approach by linking diversity progress to succession planning, leadership development, and review by management."
      ),
      ["people"],
      false
    ),
    q(
      "Governance",
      "tech_esg_data_privacy_disclosure",
      "Do you disclose ESG and data privacy policies?",
      g(
        "Identify which governance, privacy, and ESG policies should be available to stakeholders and begin organizing them clearly.",
        "Move from partial disclosure to a structured publication process with ownership, version control, and review.",
        "Improve completeness and consistency so disclosed policies reflect actual practice and are easy to find and understand.",
        "Strengthen the approach by aligning disclosure with governance review, legal checks, and external expectations."
      ),
      ["transparency", "policy"],
      false
    ),
    q(
      "Governance",
      "tech_ai_bias_misinformation",
      "Do you prevent misinformation and AI bias?",
      g(
        "Identify where your products, algorithms, or content systems could create bias or misinformation risks and define minimum controls.",
        "Move from informal concern to a documented review process with clear roles, checks, and escalation rules.",
        "Improve the approach by testing higher-risk use cases more systematically and tracking issues and remediation.",
        "Strengthen the system by integrating bias and misinformation risk review into governance, product development, and oversight."
      ),
      ["governance"],
      false
    ),
    q(
      "Governance",
      "tech_board_oversight",
      "Is there board oversight on ESG topics?",
      g(
        "Define how ESG topics should reach senior leadership or board level and which issues require formal oversight.",
        "Move from occasional updates to a repeatable governance process with defined review points and responsibilities.",
        "Improve oversight by providing clearer information, decisions, and follow-up on material ESG matters.",
        "Strengthen the approach by embedding ESG oversight into governance structures, risk review, and strategic planning."
      ),
      ["governance", "foundations"],
      false
    ),
    q(
      "Governance",
      "tech_esg_product_development",
      "Do you integrate ESG into product development?",
      g(
        "Identify which ESG considerations are most relevant during product design, testing, and release decisions.",
        "Move from ad hoc consideration to a defined product development process that includes ESG checkpoints.",
        "Improve the process by making ESG requirements more specific and applying them consistently across teams or products.",
        "Strengthen the approach by linking ESG criteria to stage-gate decisions, accountability, and product governance."
      ),
      ["governance"],
      false
    ),
    q(
      "Governance",
      "tech_anti_bribery",
      "Do you follow anti-bribery policies?",
      g(
        "Create basic written rules on gifts, conflicts of interest, and prohibited payments and communicate them internally.",
        "Move from informal integrity expectations to a formal anti-bribery framework with ownership and reporting channels.",
        "Increase effectiveness by training relevant teams, checking third-party interactions, and documenting follow-up.",
        "Strengthen the programme by linking anti-bribery controls to supplier onboarding, investigations, and management oversight."
      ),
      ["ethics", "policy"],
      false
    ),
    q(
      "Governance",
      "tech_esg_reporting",
      "Do you report ESG impacts to stakeholders?",
      g(
        "Identify which ESG topics and metrics matter most to stakeholders and begin collecting the basic information needed to report them.",
        "Move from occasional disclosure to a structured reporting process with scope, owners, and internal checks.",
        "Improve the consistency and depth of reported information and focus on the impacts most relevant to the business.",
        "Strengthen the approach by linking reporting to KPI review, governance oversight, and continuous improvement."
      ),
      ["transparency"],
      false
    ),
  ],

  Finance: [
    q(
      "Environmental",
      "finance_climate_risk_investments",
      "Do you integrate climate risk into investment decisions?",
      g(
        "Identify how climate risk could affect your portfolios, lending, or counterparties and define a basic way to review it.",
        "Move from informal consideration to a documented process for including climate risk in investment or credit decisions.",
        "Improve the process by applying more consistent criteria, scenarios, or risk flags across relevant decisions.",
        "Strengthen integration by linking climate risk review to governance, portfolio strategy, and decision approvals."
      ),
      ["governance", "metrics"],
      false
    ),
    q(
      "Environmental",
      "finance_green_projects",
      "Do you finance green or sustainable projects?",
      g(
        "Define what qualifies as green or sustainable finance in your business and identify where current activity stands.",
        "Move from opportunistic deals to a documented framework with criteria and internal ownership.",
        "Increase consistency by reviewing more transactions against the same sustainability criteria and documenting results.",
        "Strengthen the approach by linking sustainable finance activity to portfolio strategy, targets, and reporting."
      ),
      ["transparency"],
      false
    ),
    q(
      "Environmental",
      "finance_portfolio_carbon",
      "Do you track the carbon footprint of investment portfolios?",
      g(
        "Identify which portfolios or asset classes should be assessed first and begin with a basic financed emissions baseline.",
        "Move from rough estimates to a structured portfolio carbon process with scope, methodology, and data ownership.",
        "Improve the quality and coverage of portfolio emissions data and use it to identify major hotspots.",
        "Strengthen the process by linking portfolio carbon results to engagement, target setting, and portfolio construction."
      ),
      ["metrics", "transparency"],
      false
    ),
    q(
      "Environmental",
      "finance_decarbonization_targets",
      "Have you set decarbonization targets for financed emissions?",
      g(
        "Use your financed emissions baseline to define an initial decarbonization direction and a reference year.",
        "Move from broad intent to formal targets with scope, timeline, and responsibility.",
        "Refine targets by portfolio segment or time horizon and connect them to practical levers such as engagement or allocation changes.",
        "Strengthen the approach by reviewing progress regularly and integrating targets into strategy and governance."
      ),
      ["metrics", "policy"],
      false
    ),
    q(
      "Environmental",
      "finance_green_products",
      "Do you offer green financial products?",
      g(
        "Clarify which products could legitimately be positioned as green and define minimum criteria before making claims.",
        "Move from isolated offerings to a defined product framework with internal review and evidence requirements.",
        "Improve consistency across products and ensure product design reflects the sustainability criteria being communicated.",
        "Strengthen the approach by linking product governance, claims review, and performance monitoring."
      ),
      ["transparency"],
      false
    ),
    q(
      "Environmental",
      "finance_climate_esg_disclosure",
      "Do you disclose ESG risks related to climate impact?",
      g(
        "Identify which climate-related ESG risks are most material to your business and begin documenting the basic information needed to disclose them.",
        "Move from limited disclosure to a structured process with clear ownership, scope, and review.",
        "Improve the completeness and comparability of disclosed climate risk information across portfolios or business units.",
        "Strengthen the approach by aligning disclosure with governance review, risk management, and external expectations."
      ),
      ["transparency", "governance"],
      false
    ),
    q(
      "Social",
      "finance_equal_employment",
      "Do you have equal employment policies?",
      g(
        "Define basic written expectations on fair treatment, recruitment, promotion, and workplace conduct.",
        "Move from informal practice to a formal employment policy framework with ownership and communication.",
        "Improve implementation by checking whether policies are applied consistently across teams and management levels.",
        "Strengthen the system by linking it to grievance handling, training, and periodic workforce review."
      ),
      ["people", "policy"],
      false
    ),
    q(
      "Social",
      "finance_diversity_policy",
      "Do you include diversity in company policies?",
      g(
        "Review current policies and identify where diversity and inclusion expectations need to be stated more clearly.",
        "Move from general support to documented policy commitments with roles and practical application.",
        "Improve the approach by tracking where policy is not translating into balanced outcomes or representation.",
        "Strengthen the system by linking diversity policy to recruitment, promotion, leadership development, and review."
      ),
      ["people", "policy"],
      false
    ),
    q(
      "Social",
      "finance_financial_inclusion",
      "Do you support financial inclusion programs?",
      g(
        "Identify which customer groups may face barriers to access and define a few practical inclusion actions relevant to your business.",
        "Move from occasional initiatives to a clearer programme with ownership, target groups, and minimum objectives.",
        "Improve the programme by using customer data or feedback to understand which barriers remain most significant.",
        "Strengthen the approach by integrating financial inclusion into product design, outreach, and business review."
      ),
      ["people"],
      false
    ),
    q(
      "Social",
      "finance_fair_lending",
      "Do you ensure fair lending practices?",
      g(
        "Review lending criteria and customer treatment practices to identify where bias or unfair treatment risks may exist.",
        "Move from assumed fairness to a documented process with controls, responsibilities, and oversight.",
        "Improve the process by monitoring decisions, complaints, or outcomes to identify where treatment is inconsistent.",
        "Strengthen the system by linking fair lending review to training, controls, governance, and corrective action."
      ),
      ["people"],
      false
    ),
    q(
      "Social",
      "finance_human_rights_financed_companies",
      "Do you conduct human rights due diligence for financed companies?",
      g(
        "Identify where financed activities may expose the institution to human rights risk and define basic due diligence expectations.",
        "Move from limited checks to a documented review process with evidence and escalation rules.",
        "Improve the depth and consistency of due diligence for higher-risk sectors, regions, or transactions.",
        "Strengthen the approach by linking human rights findings to transaction decisions, engagement, and monitoring."
      ),
      ["human-rights"],
      false
    ),
    q(
      "Social",
      "finance_social_impact_investments",
      "Do you assess social impact in investments?",
      g(
        "Define which social outcomes are relevant to your investment activities and identify a small set of indicators to begin with.",
        "Move from broad claims to a structured social impact assessment process with scope and ownership.",
        "Improve consistency by applying the same social assessment logic across comparable transactions or portfolios.",
        "Strengthen the approach by linking social impact results to engagement, reporting, and investment review."
      ),
      ["metrics"],
      false
    ),
    q(
      "Social",
      "finance_fair_compensation",
      "Do you have fair compensation policies?",
      g(
        "Set basic written principles on fair and transparent compensation and clarify who reviews them.",
        "Move from informal pay practices to a formal compensation policy with criteria, ownership, and review rhythm.",
        "Improve the process by checking for inconsistencies or gaps across comparable roles and employee groups.",
        "Strengthen the approach by linking compensation review to governance, inclusion, and periodic workforce analysis."
      ),
      ["people"],
      false
    ),
    q(
      "Governance",
      "finance_esg_risk_framework",
      "Do you have an ESG risk management framework?",
      g(
        "Identify the ESG risks most relevant to your institution and define a simple structure for reviewing them.",
        "Move from scattered consideration to a documented ESG risk framework with ownership and review points.",
        "Improve the framework by clarifying risk categories, escalation rules, and how findings affect decisions.",
        "Strengthen the system by integrating ESG risk management into governance, strategy, and reporting."
      ),
      ["governance"],
      false
    ),
    q(
      "Governance",
      "finance_esg_investment_disclosure",
      "Do you disclose ESG investment performance?",
      g(
        "Identify which ESG investment metrics are most relevant to clients or stakeholders and start collecting the basic data required.",
        "Move from occasional disclosure to a structured process with defined methodology, ownership, and checks.",
        "Improve the consistency and comparability of disclosed ESG investment performance across products or portfolios.",
        "Strengthen the approach by aligning disclosure with governance review, product oversight, and external expectations."
      ),
      ["transparency"],
      false
    ),
    q(
      "Governance",
      "finance_esg_corporate_governance",
      "Do you integrate ESG in corporate governance?",
      g(
        "Clarify how ESG topics should be considered in governance decisions and who is responsible for escalation and review.",
        "Move from informal handling to a documented governance structure with clear roles and meeting points.",
        "Improve the process by making ESG responsibilities more consistent across committees, management, and functions.",
        "Strengthen integration by linking governance oversight to strategy, risk review, and performance monitoring."
      ),
      ["governance"],
      false
    ),
    q(
      "Governance",
      "finance_anti_corruption",
      "Do you enforce anti-corruption policies in finance operations?",
      g(
        "Create or clarify written anti-corruption rules for gifts, conflicts, third parties, and prohibited conduct.",
        "Move from basic rules to a defined compliance process with responsibilities, reporting channels, and checks.",
        "Improve effectiveness through training, documented controls, and closer attention to higher-risk roles or transactions.",
        "Strengthen the programme by linking anti-corruption controls to monitoring, investigations, and management oversight."
      ),
      ["ethics", "policy"],
      false
    ),
    q(
      "Governance",
      "finance_third_party_esg_assessments",
      "Do you conduct third-party ESG assessments?",
      g(
        "Identify where third-party ESG review would add value, such as higher-risk clients, suppliers, or investments.",
        "Move from occasional use of external assessments to a defined risk-based approach with criteria and responsibilities.",
        "Improve the process by ensuring findings are reviewed consistently and lead to decisions or follow-up actions.",
        "Strengthen the system by integrating third-party assessments into due diligence, governance, and monitoring."
      ),
      ["governance"],
      false
    ),
    q(
      "Governance",
      "finance_eu_taxonomy_alignment",
      "Do you align investment strategy with EU taxonomy?",
      g(
        "Identify whether EU taxonomy is relevant to your products or portfolios and map the most material areas first.",
        "Move from general awareness to a documented taxonomy review approach with ownership and evidence requirements.",
        "Improve alignment analysis by increasing coverage, consistency, and data quality across relevant activities.",
        "Strengthen the approach by linking taxonomy review to product strategy, disclosures, and governance oversight."
      ),
      ["governance", "policy"],
      false
    ),
    q(
      "Governance",
      "finance_esg_officer",
      "Do you have an ESG officer?",
      g(
        "Assign a clear person to coordinate ESG topics so responsibilities are not fragmented across the institution.",
        "Clarify the role, scope, and reporting line so ESG management does not depend only on informal effort.",
        "Support the role with access to cross-functional data, management discussion, and regular review routines.",
        "Strengthen the setup by embedding the role in formal governance, target tracking, and internal accountability."
      ),
      ["governance", "foundations"],
      false
    ),
  ],

  Construction: [
    q(
      "Environmental",
      "construction_activity_emissions",
      "Do you track carbon emissions from construction activities?",
      g(
        "Identify the main construction-related emission sources such as fuel, machinery, transport, and site energy and create a first baseline.",
        "Move from broad estimates to a structured emissions review with defined project boundaries and data responsibilities.",
        "Improve the process by tracking emissions more consistently across projects and using the data to identify key hotspots.",
        "Strengthen the approach by linking emissions data to project planning, supplier choices, and reduction targets."
      ),
      ["metrics", "energy"],
      false
    ),
    q(
      "Environmental",
      "construction_low_carbon_materials",
      "Do you use low-carbon or recycled materials?",
      g(
        "Review the materials with the highest footprint and identify where lower-carbon or recycled options are technically feasible.",
        "Move from occasional material substitutions to a documented selection process with criteria and supplier input.",
        "Increase the use of preferred materials across relevant projects and compare results against a baseline.",
        "Strengthen the approach by integrating material choices into design review, procurement, and project approval."
      ),
      ["circularity", "procurement"],
      false
    ),
    q(
      "Environmental",
      "construction_site_energy_saving",
      "Have you implemented energy-saving strategies on-site?",
      g(
        "Identify the main on-site energy uses and define basic measures such as equipment control, lighting efficiency, or temporary power management.",
        "Move from isolated actions to a structured site energy plan with responsibilities and review.",
        "Improve the programme by comparing performance across sites and tracking savings from implemented actions.",
        "Strengthen the approach by linking site energy management to project planning, procurement, and measurable targets."
      ),
      ["energy-efficiency"],
      false
    ),
    q(
      "Environmental",
      "construction_water_conservation",
      "Do you have a water conservation program in construction?",
      g(
        "Identify where water is used on-site and start with practical controls for high-use activities, leaks, and wastage.",
        "Formalize water management with responsibilities, monitoring, and recurring review of site performance.",
        "Improve the process by applying more consistent controls across projects and measuring whether actions reduce use.",
        "Strengthen the programme by linking water performance to site planning, contractor expectations, and targets."
      ),
      ["water"],
      false
    ),
    q(
      "Environmental",
      "construction_waste_debris",
      "Do you recycle construction debris and manage waste?",
      g(
        "Identify the main construction waste streams and begin separating and recording them in a basic but consistent way.",
        "Move from reactive waste handling to a documented process with categories, responsibilities, and contractor coordination.",
        "Improve the process by focusing on reduction at source and comparing waste performance across projects.",
        "Strengthen the approach by setting waste goals, reviewing contractor performance, and increasing material recovery."
      ),
      ["waste", "circularity"],
      false
    ),
    q(
      "Environmental",
      "construction_green_certifications",
      "Do you follow green building certifications (LEED, BREEAM)?",
      g(
        "Identify whether any recognized green building certification is relevant to your projects, market, or client expectations.",
        "Move from occasional certification interest to a planned approach with project scope, ownership, and capability requirements.",
        "Apply certification criteria more consistently across suitable projects and track where compliance gaps remain.",
        "Strengthen the approach by using certification requirements to improve internal design, construction, and reporting practices."
      ),
      ["transparency"],
      false
    ),
    q(
      "Environmental",
      "construction_renewable_energy",
      "Do you use renewable energy in operations?",
      g(
        "Review whether construction sites, offices, or supporting operations can use renewable electricity or other lower-carbon energy options.",
        "Move from isolated renewable sourcing to a documented approach with defined coverage and responsibilities.",
        "Increase renewable energy coverage across suitable operations and verify the supporting evidence.",
        "Strengthen the approach by linking renewable sourcing to emissions reduction strategy and procurement decisions."
      ),
      ["energy", "scope2"],
      false
    ),
    q(
      "Environmental",
      "construction_biodiversity_protection",
      "Do you protect biodiversity during construction?",
      g(
        "Identify whether project sites may affect habitats, vegetation, water bodies, or protected areas and define minimum controls.",
        "Move from case-by-case concern to a structured biodiversity review with responsibilities and project criteria.",
        "Improve the process by applying biodiversity controls more consistently across higher-risk projects and subcontractors.",
        "Strengthen the approach by integrating biodiversity considerations into site selection, project design, and contractor oversight."
      ),
      ["biodiversity"],
      false
    ),
    q(
      "Environmental",
      "construction_climate_resilience",
      "Have you assessed climate resilience in your projects?",
      g(
        "Identify which climate hazards such as heat, flooding, or extreme weather may affect your projects and review them at a basic level.",
        "Move from general awareness to a documented resilience assessment process during planning or design stages.",
        "Improve the process by considering resilience earlier and more consistently across comparable projects.",
        "Strengthen the approach by linking resilience assessment to design choices, project governance, and client dialogue."
      ),
      ["governance"],
      false
    ),
    q(
      "Environmental",
      "construction_circular_design",
      "Do you apply circular economy in building design?",
      g(
        "Identify where designs can better support durability, modularity, reuse, or lower waste over the building lifecycle.",
        "Move from isolated ideas to a defined circular design approach with practical criteria and responsibilities.",
        "Apply circular design thinking more consistently across projects and review the material or waste benefits achieved.",
        "Strengthen the approach by embedding circularity into design briefs, material selection, and project review."
      ),
      ["circularity"],
      false
    ),
    q(
      "Social",
      "construction_worker_safety",
      "Do you enforce strict safety and health rules for workers?",
      g(
        "Identify the highest-risk site hazards and define clear minimum rules, controls, protective equipment, and supervision.",
        "Move from basic compliance to a documented site safety system with procedures, training, and inspections.",
        "Improve the consistency of safety enforcement across projects, subcontractors, and work phases and use findings to prevent recurrence.",
        "Strengthen the system by linking safety performance to contractor management, leadership review, and continuous improvement."
      ),
      ["health-safety", "training"],
      true
    ),
    q(
      "Social",
      "construction_fair_wages",
      "Do you ensure fair wages for employees and subcontractors?",
      g(
        "Define minimum wage and payment expectations for direct workers and subcontracted labor and document them clearly.",
        "Move from assumed fairness to a formal review process with contract terms, responsibilities, and checks.",
        "Improve oversight by focusing more on subcontractors or labor chains where payment risks are higher.",
        "Strengthen the approach by linking wage expectations to procurement, audits, grievance handling, and corrective actions."
      ),
      ["people"],
      false
    ),
    q(
      "Social",
      "construction_community_engagement",
      "Do you engage local communities during construction?",
      g(
        "Identify which local stakeholders may be affected by projects and define basic communication and engagement steps.",
        "Move from reactive communication to a documented approach with responsibilities, timing, and issue logging.",
        "Improve the process by using feedback to address recurring concerns such as noise, disruption, or access.",
        "Strengthen the approach by integrating community engagement into project planning, monitoring, and review."
      ),
      ["people"],
      false
    ),
    q(
      "Social",
      "construction_workforce_diversity",
      "Do you promote diversity in the workforce?",
      g(
        "Review workforce composition and identify where access, hiring, or progression barriers may exist.",
        "Move from general support to a structured inclusion approach with practical recruitment and retention measures.",
        "Track relevant workforce indicators and focus on the stages where representation remains weakest.",
        "Strengthen the approach by linking diversity efforts to leadership accountability, training, and talent development."
      ),
      ["people"],
      false
    ),
    q(
      "Social",
      "construction_sustainable_building_training",
      "Do you offer training on sustainable building practices?",
      g(
        "Identify the sustainability topics most relevant to project teams and start with basic practical training where the need is greatest.",
        "Move from occasional awareness to a documented training plan with audiences, timing, and completion records.",
        "Tailor content more clearly to roles such as design, site management, or procurement and review whether it improves practice.",
        "Strengthen the programme by integrating training into project delivery expectations and management follow-up."
      ),
      ["training"],
      false
    ),
    q(
      "Governance",
      "construction_anti_corruption_procurement",
      "Do you have an anti-corruption policy in procurement?",
      g(
        "Create basic written rules for gifts, conflicts of interest, tender integrity, and prohibited conduct in procurement.",
        "Move from informal integrity expectations to a formal procurement anti-corruption process with roles and reporting channels.",
        "Improve implementation through training, documentation, and closer review of higher-risk procurement activities.",
        "Strengthen the programme by linking procurement controls to supplier checks, investigations, and management oversight."
      ),
      ["ethics", "policy"],
      false
    ),
    q(
      "Governance",
      "construction_supplier_subcontractor_esg",
      "Do you monitor ESG compliance of suppliers and subcontractors?",
      g(
        "Identify which suppliers and subcontractors create the highest ESG exposure and define minimum compliance expectations.",
        "Move from occasional checks to a documented review process with evidence requirements and responsibilities.",
        "Improve oversight by differentiating review depth based on risk and following up more consistently on gaps.",
        "Strengthen the system by linking supplier ESG performance to procurement decisions, site access, and corrective actions."
      ),
      ["governance", "procurement"],
      false
    ),
    q(
      "Governance",
      "construction_third_party_esg_audits",
      "Do you perform third-party ESG audits?",
      g(
        "Identify where independent ESG review would add most value, such as higher-risk projects, suppliers, or contractors.",
        "Move from occasional external reviews to a defined audit approach with scope, criteria, and follow-up roles.",
        "Improve the effectiveness of audits by ensuring findings are prioritized and tracked to closure.",
        "Strengthen the system by integrating third-party audit results into governance, supplier management, and project review."
      ),
      ["governance"],
      false
    ),
    q(
      "Governance",
      "construction_esg_reporting",
      "Do you disclose ESG performance in reports?",
      g(
        "Identify which ESG indicators are most relevant to clients, investors, or internal leadership and begin collecting basic data.",
        "Move from ad hoc disclosure to a structured reporting process with ownership, timing, and internal checks.",
        "Improve reporting consistency across projects and focus on the indicators most material to the business.",
        "Strengthen the approach by linking ESG reporting to KPIs, governance oversight, and continuous improvement."
      ),
      ["transparency"],
      false
    ),
    q(
      "Governance",
      "construction_esg_officer",
      "Is there a dedicated ESG officer?",
      g(
        "Assign a clear person to coordinate ESG topics so responsibilities are not left scattered across projects or functions.",
        "Clarify the role, reporting line, and expected tasks so ESG oversight does not depend only on individual effort.",
        "Support the role with access to data, management discussion, and cross-functional coordination.",
        "Strengthen the setup by embedding the role in formal governance, target review, and business planning."
      ),
      ["governance", "foundations"],
      false
    ),
  ],

  Furniture: [
    q(
      "Environmental",
      "furniture_certified_wood",
      "Do you use FSC/PEFC certified sustainable wood?",
      g(
        "Identify which wood-based products or suppliers should be prioritized for certified sourcing and request basic evidence.",
        "Move from occasional certified purchases to a documented sourcing approach with criteria and supplier verification.",
        "Increase the proportion of certified wood in relevant product lines and check validity of supplier certificates regularly.",
        "Strengthen the system by integrating certified sourcing into procurement strategy, traceability, and reporting."
      ),
      ["procurement", "transparency"],
      false
    ),
    q(
      "Environmental",
      "furniture_deforestation_policy",
      "Do you have a policy to reduce deforestation risks?",
      g(
        "Create a basic written policy explaining how the company will avoid sourcing linked to deforestation or uncontrolled land-use risk.",
        "Move from a policy statement to a practical sourcing process with responsibilities and supplier expectations.",
        "Improve implementation by focusing more closely on higher-risk materials, regions, or suppliers and checking evidence.",
        "Strengthen the approach by linking deforestation risk review to procurement decisions, traceability, and corrective action."
      ),
      ["policy", "procurement"],
      false
    ),
    q(
      "Environmental",
      "furniture_recycled_materials",
      "Do you use recycled materials in production?",
      g(
        "Review where recycled materials could be introduced without compromising product quality or safety and define priority areas.",
        "Move from isolated material substitutions to a documented sourcing or design approach with criteria and supplier input.",
        "Increase the use of recycled content in relevant product lines and track progress against a baseline.",
        "Strengthen the approach by integrating recycled material use into product development, procurement, and performance review."
      ),
      ["circularity"],
      false
    ),
    q(
      "Environmental",
      "furniture_carbon_logistics",
      "Do you track and reduce carbon emissions from production and logistics?",
      g(
        "Identify the main emission sources across manufacturing and transport and build a simple baseline for both areas.",
        "Move from rough estimates to a structured review process with boundaries, ownership, and regular updates.",
        "Improve the quality of emissions data and use it to target the biggest hotspots in production and logistics.",
        "Strengthen the approach by linking emissions results to material choices, transport planning, and reduction targets."
      ),
      ["metrics", "logistics"],
      false
    ),
    q(
      "Environmental",
      "furniture_chemical_finishing",
      "Do you follow eco-friendly finishing and chemical safety?",
      g(
        "Create an inventory of finishes, coatings, and chemicals used and identify where safer or lower-impact alternatives may exist.",
        "Move from basic handling to a documented chemical and finishing management process with approval controls and responsibilities.",
        "Improve the system by tracking substitution progress and applying controls more consistently across products and suppliers.",
        "Strengthen the approach by linking chemical management to procurement, worker training, product compliance, and review."
      ),
      ["chemicals"],
      false
    ),
    q(
      "Environmental",
      "furniture_takeback_recycling",
      "Do you have a take-back/recycling program for furniture?",
      g(
        "Identify whether products can realistically be collected, repaired, refurbished, or recycled and define a basic process.",
        "Move from occasional returns handling to a documented take-back or recycling programme with clear ownership.",
        "Improve the programme by increasing participation, tracking recovery outcomes, and identifying barriers to scale.",
        "Strengthen the approach by linking take-back to product design, customer service, and circular business opportunities."
      ),
      ["circularity", "waste"],
      false
    ),
    q(
      "Environmental",
      "furniture_water_pollution",
      "Have you assessed water usage and pollution in manufacturing?",
      g(
        "Identify where water is used or where wastewater or pollution risk may occur and establish a simple baseline.",
        "Move from occasional checks to a structured review of water use, discharge risk, responsibilities, and controls.",
        "Improve the process by increasing measurement quality and focusing on the process steps with the highest water or pollution exposure.",
        "Strengthen the approach by linking findings to operational controls, treatment measures, and performance targets."
      ),
      ["water"],
      false
    ),
    q(
      "Environmental",
      "furniture_circular_strategies",
      "Do you follow circular economy strategies?",
      g(
        "Identify where furniture design, materials, packaging, or product life can be improved through reuse, repair, or recycling thinking.",
        "Move from isolated circular ideas to a defined strategy with scope, ownership, and priority actions.",
        "Apply circular strategies more consistently across relevant product lines and measure the benefits achieved.",
        "Strengthen the approach by embedding circularity into design briefs, sourcing, customer offers, and supplier collaboration."
      ),
      ["circularity"],
      false
    ),
    q(
      "Social",
      "furniture_fair_labor_factories",
      "Do you ensure fair labor conditions in your factories?",
      g(
        "Define minimum expectations on wages, hours, treatment, and working conditions for factory workers and communicate them clearly.",
        "Move from assumed good practice to a documented labor framework with responsibilities and checks.",
        "Improve implementation across shifts, sites, or contractors and collect evidence that standards are actually applied.",
        "Strengthen the system by linking labor expectations to grievance handling, supervision, and supplier or contractor review."
      ),
      ["human-rights", "people"],
      false
    ),
    q(
      "Social",
      "furniture_supplier_ethical_sourcing",
      "Do your suppliers follow ethical sourcing standards?",
      g(
        "Identify the suppliers with the highest social or environmental exposure and define minimum ethical sourcing expectations.",
        "Move from broad supplier expectations to a documented review process with evidence requirements and follow-up.",
        "Improve oversight by focusing more on higher-risk suppliers and tracking whether identified issues are corrected.",
        "Strengthen the approach by linking ethical sourcing performance to supplier selection, contracts, and improvement plans."
      ),
      ["procurement", "human-rights"],
      false
    ),
    q(
      "Social",
      "furniture_safety_audits",
      "Do you perform safety audits for workers?",
      g(
        "Identify which work areas or operations would benefit most from structured safety checks and define a basic audit routine.",
        "Move from informal walkthroughs to a documented safety audit process with responsibilities and records.",
        "Improve the usefulness of audits by focusing on recurring issues, corrective actions, and higher-risk tasks.",
        "Strengthen the system by integrating audit results into training, prevention planning, and management review."
      ),
      ["health-safety"],
      false
    ),
    q(
      "Social",
      "furniture_training_development",
      "Do you offer training and development programs?",
      g(
        "Identify the most important skill gaps for workers and start with basic training where operational need is highest.",
        "Move from occasional learning opportunities to a documented programme with audience, timing, and ownership.",
        "Tailor training more clearly to roles and review whether employees can actually apply what they learn.",
        "Strengthen the approach by linking development plans to performance, retention, and leadership review."
      ),
      ["training"],
      false
    ),
    q(
      "Social",
      "furniture_local_communities",
      "Do you work with local communities on sustainable wood sourcing?",
      g(
        "Identify which communities or local actors are relevant to your wood sourcing and define a few practical engagement steps.",
        "Move from occasional contact to a documented community engagement approach with responsibilities and objectives.",
        "Improve the process by using feedback to understand whether local relationships are supporting more sustainable sourcing in practice.",
        "Strengthen the approach by integrating community engagement into sourcing strategy, traceability, and supplier expectations."
      ),
      ["people"],
      false
    ),
    q(
      "Social",
      "furniture_gender_diversity",
      "Do you promote gender diversity in leadership?",
      g(
        "Review leadership composition and identify where recruitment, promotion, or retention barriers may exist.",
        "Move from general support to a structured diversity approach with clearer responsibilities and talent processes.",
        "Track relevant indicators and focus on the points where representation is weakest.",
        "Strengthen the approach by linking gender diversity progress to development plans, succession, and leadership review."
      ),
      ["people"],
      false
    ),
    q(
      "Governance",
      "furniture_supply_chain_reporting",
      "Do you disclose supply chain transparency in ESG reports?",
      g(
        "Identify which supplier or material traceability information is most important to disclose and begin collecting it consistently.",
        "Move from partial disclosure to a structured reporting process with ownership and evidence checks.",
        "Improve the depth and consistency of supply chain transparency information across relevant product categories.",
        "Strengthen the approach by linking supply chain reporting to traceability systems, procurement review, and governance oversight."
      ),
      ["transparency", "procurement"],
      false
    ),
    q(
      "Governance",
      "furniture_esg_risk_strategy",
      "Do you have an ESG risk management strategy?",
      g(
        "Identify the ESG risks most likely to affect sourcing, compliance, products, or reputation and define a basic review structure.",
        "Move from scattered awareness to a documented ESG risk strategy with owners and review points.",
        "Improve the process by ranking risks, clarifying actions, and integrating them into business planning.",
        "Strengthen the approach by linking ESG risk review to governance, targets, and management decisions."
      ),
      ["governance"],
      false
    ),
    q(
      "Governance",
      "furniture_supplier_due_diligence",
      "Do you audit suppliers on ESG due diligence?",
      g(
        "Identify the suppliers where ESG audits or structured due diligence would add most value and define minimum criteria.",
        "Move from occasional supplier review to a formal risk-based due diligence and audit process.",
        "Improve effectiveness by focusing on higher-risk suppliers and ensuring corrective actions are tracked to closure.",
        "Strengthen the system by linking due diligence results to sourcing decisions, contracts, and supplier development."
      ),
      ["governance", "procurement"],
      false
    ),
    q(
      "Governance",
      "furniture_greenwashing",
      "Do you ensure responsible marketing (avoid greenwashing)?",
      g(
        "Review current sustainability claims and identify where wording may be too broad, unsupported, or misleading.",
        "Move from informal claim review to a documented approval process with evidence and responsibility.",
        "Improve consistency by checking that product, sourcing, and environmental claims match actual data and documentation.",
        "Strengthen the approach by linking claim approval to governance, legal review, and periodic reassessment."
      ),
      ["ethics", "transparency"],
      false
    ),
    q(
      "Governance",
      "furniture_esg_business_strategy",
      "Do you integrate ESG into business strategy?",
      g(
        "Identify the ESG issues most likely to affect sourcing, costs, customers, or compliance and include them in planning discussions.",
        "Move from general awareness to a documented strategic process where ESG topics influence decisions.",
        "Improve the process by ranking priorities, assigning ownership, and linking them to budgets or commercial plans.",
        "Strengthen integration by reviewing ESG priorities regularly at management level and tying them to targets and action plans."
      ),
      ["governance"],
      false
    ),
    q(
      "Governance",
      "furniture_esg_results_reporting",
      "Do you report ESG results to stakeholders?",
      g(
        "Identify which ESG results matter most to customers, investors, or partners and begin collecting the basic data needed.",
        "Move from ad hoc communication to a structured reporting process with defined ownership and checks.",
        "Improve reporting quality by increasing consistency, comparability, and completeness across priority topics.",
        "Strengthen the approach by linking ESG reporting to KPIs, governance review, and continuous improvement."
      ),
      ["transparency"],
      false
    ),
  ],

  Transportation: [
    q(
      "Environmental",
      "transport_logistics_emissions",
      "Do you track and reduce CO₂ emissions from logistics and transport?",
      g(
        "Identify the main emission sources such as fleet fuel use, routes, subcontracted transport, or hubs and build a first baseline.",
        "Move from rough estimates to a structured emissions review with clear boundaries, responsibilities, and update frequency.",
        "Improve the quality of transport emissions data and use it to identify the biggest operational hotspots.",
        "Strengthen the approach by linking emissions results to route planning, fleet choices, supplier review, and targets."
      ),
      ["metrics", "logistics"],
      true
    ),
    q(
      "Environmental",
      "transport_low_emission_vehicles",
      "Do you use electric or low-emission vehicles in your fleet?",
      g(
        "Review which parts of the fleet could realistically shift to lower-emission vehicles and identify the main barriers.",
        "Move from isolated vehicle changes to a documented fleet transition approach with priorities and ownership.",
        "Increase the share of lower-emission vehicles where operationally viable and track results against a baseline.",
        "Strengthen the approach by linking fleet transition to infrastructure planning, procurement, and emissions targets."
      ),
      ["logistics"],
      false
    ),
    q(
      "Environmental",
      "transport_route_optimization",
      "Have you optimized delivery routes to save fuel?",
      g(
        "Review current routes and identify where distance, idling, load factors, or scheduling create avoidable fuel use.",
        "Move from driver-by-driver decisions to a documented route optimization approach with clear criteria and review.",
        "Improve the process by tracking route performance and using the data to refine planning more consistently.",
        "Strengthen the approach by linking route optimization to fleet management, driver behaviour, and emissions targets."
      ),
      ["logistics", "energy-efficiency"],
      false
    ),
    q(
      "Environmental",
      "transport_alternative_fuels",
      "Do you use alternative fuels (biofuels, hydrogen)?",
      g(
        "Assess whether alternative fuels are relevant for your fleet profile and identify realistic pilot areas rather than adopting them blindly.",
        "Move from isolated experimentation to a documented evaluation approach with criteria, costs, and operational fit.",
        "Increase use only where evidence shows a credible environmental and operational benefit.",
        "Strengthen the approach by integrating alternative fuel decisions into fleet strategy, infrastructure planning, and performance review."
      ),
      ["logistics", "energy"],
      false
    ),
    q(
      "Environmental",
      "transport_air_pollution",
      "Do you reduce air pollution from logistics operations?",
      g(
        "Identify the operations most likely to generate local air pollution and define a few practical control measures.",
        "Move from general concern to a documented process for managing and reviewing local air quality impacts.",
        "Improve the process by focusing on the highest-impact vehicles, hubs, or routes and tracking improvement.",
        "Strengthen the approach by linking air pollution reduction to fleet renewal, route planning, and contractor expectations."
      ),
      ["logistics"],
      false
    ),
    q(
      "Environmental",
      "transport_offset_programs",
      "Do you run carbon offset programs?",
      g(
        "Clarify whether offsetting is appropriate for your business and avoid using it as a substitute for direct transport reductions.",
        "Move from occasional offsetting to a documented approach with quality criteria, evidence, and transparent communication.",
        "Review offset use more critically and ensure it stays limited compared with direct emissions reduction efforts.",
        "Strengthen the approach by prioritizing direct fleet and route reductions first and using offsets only with strong governance."
      ),
      ["transparency"],
      false
    ),
    q(
      "Environmental",
      "transport_ecodriving_training",
      "Do you offer eco-driving training for drivers?",
      g(
        "Identify the driver behaviours that most affect fuel use and start with practical training on a few key habits.",
        "Move from occasional reminders to a structured eco-driving programme with defined audiences and follow-up.",
        "Track whether training is influencing driving behaviour or fuel performance and adapt the content accordingly.",
        "Strengthen the programme by linking eco-driving to fleet data, driver feedback, and performance review."
      ),
      ["training", "logistics"],
      false
    ),
    q(
      "Environmental",
      "transport_hub_waste",
      "Do you manage waste in transport hubs responsibly?",
      g(
        "Identify the main waste streams at hubs or depots and begin separating and recording them consistently.",
        "Move from basic disposal to a documented waste management process with categories, roles, and contractor coordination.",
        "Improve performance by reviewing waste trends and focusing on avoidable waste at source.",
        "Strengthen the system by setting waste goals, reviewing contractor performance, and increasing recovery options."
      ),
      ["waste"],
      false
    ),
    q(
      "Social",
      "transport_driver_conditions",
      "Do you ensure safe and fair working conditions for drivers?",
      g(
        "Define minimum expectations on hours, rest, treatment, and safety for drivers and communicate them clearly.",
        "Move from assumed good practice to a formal framework with responsibilities, monitoring, and escalation rules.",
        "Improve implementation across direct and subcontracted drivers and review complaints, incidents, or risk indicators.",
        "Strengthen the system by linking driver conditions to contractor management, audits, and leadership review."
      ),
      ["people", "health-safety"],
      false
    ),
    q(
      "Social",
      "transport_fatigue_management",
      "Do you have fatigue management systems for long-distance drivers?",
      g(
        "Identify where fatigue risk is highest and define basic controls around scheduling, rest, and supervision.",
        "Move from informal awareness to a documented fatigue management process with responsibilities and monitoring.",
        "Improve the system by using route, schedule, or incident data to spot where controls are not working well enough.",
        "Strengthen the approach by linking fatigue management to dispatch planning, contractor oversight, and safety review."
      ),
      ["health-safety"],
      false
    ),
    q(
      "Social",
      "transport_inclusion_diversity",
      "Do you have inclusion and diversity policies?",
      g(
        "Define basic written expectations on respectful treatment, equal opportunity, and workplace conduct.",
        "Move from general support to a formal inclusion policy framework with ownership and communication.",
        "Improve implementation by checking whether practices are consistent across recruitment, teams, and management levels.",
        "Strengthen the approach by linking inclusion policy to training, grievance handling, and periodic workforce review."
      ),
      ["people", "policy"],
      false
    ),
    q(
      "Social",
      "transport_esg_training",
      "Do you train employees on ESG topics?",
      g(
        "Identify the ESG topics most relevant to transport operations and start with simple role-relevant training.",
        "Move from occasional awareness to a documented training plan with target groups, timing, and completion records.",
        "Tailor training by role and check whether it is leading to better operational practices or compliance.",
        "Strengthen the programme by integrating ESG training into job expectations, refresh cycles, and management follow-up."
      ),
      ["training"],
      false
    ),
    q(
      "Social",
      "transport_subcontractor_labor",
      "Do you monitor subcontractor labor practices?",
      g(
        "Identify which subcontractors carry the highest labor risk and define minimum expectations and checks for them.",
        "Move from trust-based oversight to a documented review process with evidence requirements and follow-up.",
        "Improve the process by increasing scrutiny of higher-risk subcontractors and tracking corrective actions more closely.",
        "Strengthen the system by linking labor practice performance to procurement decisions, contract renewal, and audits."
      ),
      ["human-rights", "procurement"],
      false
    ),
    q(
      "Social",
      "transport_local_communities",
      "Do you engage local communities impacted by transport?",
      g(
        "Identify the communities most affected by your routes, hubs, noise, or traffic and define basic engagement steps.",
        "Move from reactive handling of complaints to a documented engagement process with ownership and issue logging.",
        "Use feedback more systematically to address recurring concerns and improve local impact management.",
        "Strengthen the approach by integrating community engagement into route planning, hub management, and review."
      ),
      ["people"],
      false
    ),
    q(
      "Governance",
      "transport_supplier_esg_screening",
      "Do you have ESG screening for suppliers?",
      g(
        "Identify the supplier categories that create the highest ESG exposure and define minimum screening criteria for them.",
        "Move from occasional supplier checks to a documented screening process with evidence and responsibilities.",
        "Improve the process by differentiating screening depth based on supplier risk and tracking follow-up actions.",
        "Strengthen the system by linking ESG screening results to supplier approval, contract terms, and development plans."
      ),
      ["governance", "procurement"],
      false
    ),
    q(
      "Governance",
      "transport_esg_kpis",
      "Do you track and report ESG KPIs?",
      g(
        "Select a small set of ESG indicators relevant to transport operations and begin collecting basic baseline data.",
        "Move from scattered metrics to a structured KPI process with defined ownership, timing, and validation.",
        "Improve the coverage and consistency of ESG KPIs across fleet, labor, safety, and governance topics.",
        "Strengthen the approach by linking KPIs to targets, management review, and reporting."
      ),
      ["metrics", "transparency"],
      false
    ),
    q(
      "Governance",
      "transport_eu_emissions_compliance",
      "Do you comply with EU emissions regulations?",
      g(
        "Identify which EU emissions obligations apply to your operations and assign responsibility for tracking them.",
        "Move from reactive compliance to a documented legal review process with clear ownership and update rhythm.",
        "Improve implementation by checking whether compliance requirements are applied consistently across fleet and operations.",
        "Strengthen the approach by linking compliance review to governance, fleet planning, and corrective action."
      ),
      ["governance", "policy"],
      false
    ),
    q(
      "Governance",
      "transport_esg_transport_planning",
      "Do you integrate ESG into transport planning?",
      g(
        "Identify which ESG factors such as emissions, driver welfare, local impact, or supplier risk should influence planning decisions.",
        "Move from ad hoc consideration to a defined planning process that includes ESG criteria.",
        "Improve the process by applying ESG criteria more consistently across route, fleet, and supplier planning decisions.",
        "Strengthen integration by linking ESG planning criteria to governance, targets, and performance review."
      ),
      ["governance"],
      false
    ),
    q(
      "Governance",
      "transport_anti_bribery_procurement",
      "Do you have anti-bribery rules in procurement?",
      g(
        "Create written rules on gifts, conflicts of interest, tender integrity, and prohibited payments in procurement activity.",
        "Move from informal expectations to a formal anti-bribery process with responsibilities and reporting channels.",
        "Improve implementation through training, documentation, and closer review of higher-risk procurement activity.",
        "Strengthen the programme by linking procurement controls to supplier onboarding, investigations, and management oversight."
      ),
      ["ethics", "policy"],
      false
    ),
    q(
      "Governance",
      "transport_fuel_efficiency_disclosure",
      "Do you disclose fuel efficiency and emissions data?",
      g(
        "Identify which fuel and emissions indicators are most relevant to customers or stakeholders and begin collecting them consistently.",
        "Move from occasional disclosure to a structured process with clear scope, ownership, and evidence checks.",
        "Improve reporting quality by increasing consistency across operations and making the data more comparable over time.",
        "Strengthen the approach by linking disclosure to KPI review, management oversight, and external expectations."
      ),
      ["transparency"],
      false
    ),
  ],
};

// =====================
// ACCESS FUNCTIONS
// =====================

export function getQuestionsBySector(sector) {
  const key = sectorAlias[sector] ?? sector;
  return (data || {})[key] || [];
}

export function getQuestionsForSector(sector) {
  const key = sectorAlias[sector] ?? sector;
  const raw = (data || {})[key] || [];

  return raw.map((item) => {
    const pillar = pillarMap[item.category] ?? "E";
    const tags = normalizeTags(item.tags);
    const weight = Number.isFinite(item.weight)
      ? item.weight
      : inferWeight({
          pillar,
          tags,
          critical: !!item.critical,
        });

    return {
      id: item.id,
      text: item.question,
      question: item.question,
      category: item.category,
      pillar,
      type: "yesno",
      tags,
      critical: !!item.critical,
      weight,
      guidance: item.guidance,
    };
  });
}

export default data;