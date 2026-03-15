/**
 * Seed community data for development.
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed_community.ts
 */
import { PrismaClient, PostType, Direction, RoomType, ReputationAction } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding community data...');

  // Get first user (fallback to creating one)
  let user = await prisma.user.findFirst();
  if (!user) {
    console.log('No users found. Please seed a user first.');
    return;
  }

  const userId = user.id;

  // Create chat rooms
  const globalRoom = await prisma.chatRoom.upsert({
    where: { symbol: '__GLOBAL__' },
    create: { name: 'Global', type: RoomType.GLOBAL, symbol: '__GLOBAL__' },
    update: {},
  });
  console.log(`  Global chat room: ${globalRoom.id}`);

  const symbolRooms = ['EURUSD', 'GBPUSD', 'XAUUSD', 'BTCUSD', 'NAS100'];
  for (const sym of symbolRooms) {
    await prisma.chatRoom.upsert({
      where: { symbol: sym },
      create: { name: sym, type: RoomType.SYMBOL, symbol: sym },
      update: {},
    });
  }
  console.log(`  Created ${symbolRooms.length} symbol rooms`);

  // Create sample posts
  const posts = [
    {
      type: PostType.TRADE_IDEA,
      symbol: 'EURUSD',
      timeframe: 'H4',
      direction: Direction.BULLISH,
      entry: 1.085,
      sl: 1.08,
      tp: 1.095,
      description:
        'EURUSD showing strong bullish divergence on the H4 chart. Price broke above the descending trendline with volume. Looking for a move towards 1.095 with SL below the recent swing low.',
    },
    {
      type: PostType.ANALYSIS,
      symbol: 'XAUUSD',
      timeframe: 'D1',
      direction: Direction.BULLISH,
      description:
        'Gold daily analysis: Strong support at 2300, with the 200 EMA acting as dynamic support. Weekly structure is bullish. Expecting continuation to 2400 area.',
    },
    {
      type: PostType.TRADE_IDEA,
      symbol: 'GBPJPY',
      timeframe: 'H1',
      direction: Direction.BEARISH,
      entry: 192.5,
      sl: 193.2,
      tp: 190.0,
      description:
        'GBPJPY short setup. Double top pattern forming at resistance zone. RSI divergence on H1. Risk is tight at 70 pips for a potential 250 pip move. R:R roughly 1:3.5',
    },
    {
      type: PostType.DISCUSSION,
      symbol: 'BTCUSD',
      timeframe: 'D1',
      direction: Direction.NEUTRAL,
      description:
        'What are your thoughts on BTC consolidation between 60-70k? Are we building for a breakout or distribution? Share your analysis below.',
    },
    {
      type: PostType.FORECAST,
      symbol: 'NAS100',
      timeframe: 'W1',
      direction: Direction.BULLISH,
      description:
        'NAS100 weekly forecast: The tech sector continues to show strength. Key AI stocks driving momentum. As long as we hold above 17500, the trend remains bullish. Next target: 19000.',
    },
  ];

  for (const postData of posts) {
    await prisma.communityPost.create({
      data: {
        userId,
        ...postData,
        trendingScore: Math.random() * 5,
      },
    });
  }
  console.log(`  Created ${posts.length} sample posts`);

  // Add some reputation events
  await prisma.reputationEvent.createMany({
    data: [
      { userId, action: ReputationAction.POST_CREATED, points: 10 },
      { userId, action: ReputationAction.POST_CREATED, points: 10 },
      { userId, action: ReputationAction.POST_CREATED, points: 10 },
      { userId, action: ReputationAction.POST_LIKED, points: 5 },
      { userId, action: ReputationAction.POST_LIKED, points: 5 },
      { userId, action: ReputationAction.COMMENT_CREATED, points: 2 },
    ],
  });

  await prisma.user.update({
    where: { id: userId },
    data: { reputationScore: 42 },
  });
  console.log('  Updated user reputation score');

  // Add a chat message
  await prisma.chatMessage.create({
    data: {
      roomId: globalRoom.id,
      userId,
      content: 'Welcome to the TradePro community! Share your trade ideas and discuss strategies.',
    },
  });
  console.log('  Added welcome message to global chat');

  console.log('Community seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
