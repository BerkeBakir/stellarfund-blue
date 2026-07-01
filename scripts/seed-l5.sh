#!/usr/bin/env bash
# Seed L5 demo campaigns: tops up each category to 3-4 campaigns.
# Creates each on-chain via Factory (milestone escrow) then POSTs identity
# metadata to the live Blue site. Idempotent-ish: re-running creates NEW
# on-chain campaigns, so run ONCE.
set -uo pipefail
export PATH="$HOME/.cargo/bin:$PATH"

NET=testnet
SRC=stellarfund
G=$(stellar keys address $SRC)
FACTORY=CDNLINFENSRBB3WZ4JCSJC5PPJT6CZJPSQ7EY5W2HC4UYZVHMGVHVNAF
BASE=https://stellarfund-blue.vercel.app
NOW=$(date +%s)
DEADLINE=$((NOW + 3888000))   # ~45 days out -> active campaigns

retry(){ for i in 1 2 3 4 5; do out=$("$@" 2>/dev/null) && [[ -n "$out" ]] && { echo "$out"; return 0; }; sleep 8; done; return 1; }

# title | category | creator | description | goalUSDC | m1,m2,...(USDC, sum=goal)
CAMPAIGNS=(
  "Rural library internet|Education|Mr. Okoro|Satellite internet and routers so a village library can offer free online learning.|150|75,75"
  "STEM kits for girls|Education|Ada Initiative|Hands-on robotics and electronics kits for an after-school girls STEM club.|200|80,120"
  "Mobile vaccination drive|Health|Dr. Sara|A mobile clinic running childhood vaccination days across three remote villages.|400|150,150,100"
  "Maternal care fund|Health|Hope Midwives|Safe-birth kits and prenatal checkups for expecting mothers without clinic access.|250|125,125"
  "Wheelchair workshop|Health|Mobility Co-op|Locally built, repairable wheelchairs for people in a low-income district.|180|60,60,60"
  "Solar microgrid|Technology|Kwame|A shared solar microgrid powering twenty homes and a small workshop.|500|200,150,150"
  "Open-source farm sensors|Technology|Deniz|Low-cost soil and weather sensors that help smallholders plan irrigation.|220|110,110"
  "Community fiber mesh|Technology|MeshNet|A neighbourhood-owned wireless mesh bringing affordable internet to 50 homes.|350|175,175"
  "Youth football pitch|Community|Local Sports Club|Resurfacing a community football pitch and providing kit for a youth league.|160|80,80"
  "Night market stalls|Community|Traders Guild|Weatherproof stalls so street vendors can trade safely through the rainy season.|140|70,70"
  "Neighbourhood compost hub|Community|Green Block|A shared composting and urban-garden hub turning food waste into local produce.|120|40,40,40"
  "Earthquake shelter kits|Emergency|Relief Team|Tents, blankets and water filters pre-positioned for earthquake-prone districts.|450|150,150,150"
  "Wildfire evacuation fund|Emergency|First Responders|Fuel, transport and emergency lodging for families evacuating wildfire zones.|300|150,150"
  "Clean water after the storm|Emergency|AquaAid|Water purification tablets and tanks for communities hit by a recent cyclone.|200|100,100"
  "Documentary on migrant artisans|Other|Studio Mira|An independent documentary preserving the craft of displaced artisan families.|180|90,90"
)

echo "Creator: $G"
echo "Factory: $FACTORY"
echo "Seeding ${#CAMPAIGNS[@]} campaigns..."
echo

OK=0
for entry in "${CAMPAIGNS[@]}"; do
  IFS='|' read -r title category creator description goal milestones <<< "$entry"
  goal_base=$((goal * 10000000))
  # build milestone JSON array (i128 as strings)
  IFS=',' read -ra parts <<< "$milestones"
  m_json="["
  for i in "${!parts[@]}"; do
    [[ $i -gt 0 ]] && m_json+=","
    m_json+="\"$(( ${parts[$i]} * 10000000 ))\""
  done
  m_json+="]"

  echo ">> $title ($category) goal=$goal USDC milestones=$m_json"
  ADDR=$(retry stellar contract invoke --id "$FACTORY" --source "$SRC" --network "$NET" -- \
    create_campaign --creator "$G" --goal "$goal_base" --deadline "$DEADLINE" --milestones "$m_json" | tr -d '"')

  if [[ -z "$ADDR" ]]; then
    echo "   !! create failed for: $title"
    continue
  fi
  echo "   on-chain: $ADDR"

  body=$(printf '{"address":"%s","title":"%s","description":"%s","category":"%s","creatorName":"%s","imageUrl":null,"createdAt":"%s"}' \
    "$ADDR" "$title" "$description" "$category" "$creator" "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)")
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/campaigns" \
    -H "content-type: application/json" -d "$body")
  echo "   metadata POST -> HTTP $status"
  [[ "$status" == "200" || "$status" == "201" ]] && OK=$((OK+1))
  echo
done

echo "Done. $OK/${#CAMPAIGNS[@]} metadata records written."
