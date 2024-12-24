const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const translate = require('google-translate-api-x');
const fetch = require('node-fetch');

// Load configuration from config.json
const config = require('./config.json');

// Initialize the bot client with the required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences, // Add this line
  ],
});

let messageHistory = {}; // Store message history for each user
let learnedWords = []; // Array to store learned words
let germanWords = []; // Array to store German words
let cooldownMessages = new Map(); // Map to track cooldown for each user
let respondedMessages = new Set(); // Set to track responded messages

const learnedWordsFilePath = path.join(__dirname, 'learned_words.json');
const messageHistoryFilePath = path.join(__dirname, 'messageHistory.json');
const botScriptFilePath = path.join(__dirname, 'bot.js'); // Path to your bot's main script
const germanWordsFilePath = path.join(__dirname, 'german_words.json'); // Path to the German words file

// Load the learned words if they exist
if (fs.existsSync(learnedWordsFilePath)) {
  try {
    learnedWords = JSON.parse(fs.readFileSync(learnedWordsFilePath));
  } catch (error) {
    console.error('Error parsing learned_words.json:', error);
    learnedWords = []; // Initialize with an empty array if the file is invalid
  }
} else {
  learnedWords = []; // Initialize with an empty array if the file doesn't exist
}

// Load the German words if they exist
if (fs.existsSync(germanWordsFilePath)) {
  try {
    germanWords = JSON.parse(fs.readFileSync(germanWordsFilePath));
  } catch (error) {
    console.error('Error parsing germanWords.json:', error);
    germanWords = []; // Initialize with an empty array if the file is invalid
  }
} else {
  germanWords = []; // Initialize with an empty array if the file doesn't exist
}

// Load the message history if it exists
if (fs.existsSync(messageHistoryFilePath)) {
  try {
    messageHistory = JSON.parse(fs.readFileSync(messageHistoryFilePath));
  } catch (error) {
    console.error('Error parsing messageHistory.json:', error);
    messageHistory = {}; // Initialize with an empty object if the file is invalid
  }
} else {
  messageHistory = {}; // Initialize with an empty object if the file doesn't exist
}

// Event: when the bot is ready
client.once('ready', () => {
  console.log('Bot is online!');
});

// Event listener for messages
client.on('messageCreate', async (message) => {
  if (message.author.bot || message.system) return; // Ignore bot and system messages

  const userId = message.author.id;
  const currentTimestamp = Date.now(); // Define the current timestamp

  // Check if the user is on cooldown (1 second cooldown)
  if (cooldownMessages.has(userId) && currentTimestamp - cooldownMessages.get(userId) < 1000) {
    return; // Prevent message processing if on cooldown
  }

  // Set the cooldown timestamp for the user
  cooldownMessages.set(userId, currentTimestamp);

  // Command: !stats
if (message.content.startsWith('!stats')) {
  try {
    // Check if the message mentions a user or not
    let userToFetch = message.author; // Default to the message author

    // If a user is mentioned, use that user
    const mentionedUser = message.mentions.users.first();
    if (mentionedUser) {
      userToFetch = mentionedUser; // Set to mentioned user
    }

    // Get the user object to fetch the status and profile picture
    const user = await message.guild.members.fetch(userToFetch.id);
    const status = user.presence ? user.presence.status : 'offline';
    const profilePicture = user.user.displayAvatarURL({ dynamic: true });

    // Calculate the most and least used words
    const userMessages = messageHistory[userToFetch.id] || [];
    const wordCounts = {};

    // Count the occurrences of each word in the user's message history
    userMessages.forEach((msg) => {
      msg.content.split(' ').forEach((word) => {
        word = word.toLowerCase();
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });

    // Sort the words by frequency
    const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);

    // Get the most and least used words
    const mostUsedWord = sortedWords.length > 0 ? sortedWords[0][0] : 'N/A';
    const leastUsedWord = sortedWords.length > 0 ? sortedWords[sortedWords.length - 1][0] : 'N/A';

    // Create the stats embed
    const statsEmbed = new EmbedBuilder()
      .setTitle(`${userToFetch.username}'s Stats`)
      .setDescription(`Here are the stats for ${userToFetch.username}:`)
      .setThumbnail(profilePicture) // Profile picture
      .addFields(
        { name: 'Status', value: status.charAt(0).toUpperCase() + status.slice(1), inline: true },
        { name: 'Most Used Word', value: mostUsedWord, inline: true },
        { name: 'Least Used Word', value: leastUsedWord, inline: true }
      );

    // Send the embed
    await message.reply({ embeds: [statsEmbed] });

  } catch (error) {
    console.error('Error fetching user stats:', error);
    await message.reply('Sorry, there was an error fetching the stats.');
  }
}

  // Command: !viewfiles
  if (message.content === '!viewfiles') {
    try {
      const learnedWordsStats = fs.statSync(learnedWordsFilePath);
      const messageHistoryStats = fs.statSync(messageHistoryFilePath);
      const botScriptStats = fs.statSync(botScriptFilePath);
      const botScriptLines = fs.readFileSync(botScriptFilePath, 'utf-8').split('\n').length;

      const fileSizesEmbed = new EmbedBuilder()
        .setTitle('File Sizes & Script Info')
        .setDescription('Here are the sizes of the bot files and the number of lines in the script:')
        .addFields(
          {
            name: 'learned_words.json',
            value: `${(learnedWordsStats.size / 1024).toFixed(2)} KB || 'N/A'`,
          },
          {
            name: 'messageHistory.json',
            value: `${(messageHistoryStats.size / 1024).toFixed(2)} KB || 'N/A'`,
          },
          {
            name: 'Bot Script (index.js)',
            value: `${(botScriptStats.size / 1024).toFixed(2)} KB || 'N/A'`,
          },
          {
            name: 'Bot Script Lines',
            value: `${botScriptLines} lines of code || 'N/A'`,
          }
        );

      await message.reply({ embeds: [fileSizesEmbed] });

    } catch (error) {
      console.error('Error getting file sizes or line count:', error);
      await message.reply('Sorry, I encountered an error while retrieving file information.');
    }
  }

  // Command: !randomword german
  if (message.content === '!randomword german') {
    if (germanWords.length > 0) {
      const randomWord = germanWords[Math.floor(Math.random() * germanWords.length)];
      try {
        const translation = await translate.translate(randomWord, { to: 'en' });
        await message.reply(`**German Word:** ${randomWord}\n**Translation:** ${translation.text}`);
      } catch (err) {
        console.error('Error translating:', err);
        await message.reply('Sorry, there was an error translating the word.');
      }
    } else {
      await message.reply('No German words found.');
    }
  }

  // Lock the message to avoid replying twice
  cooldownMessages.set(userId, currentTimestamp); // Set the cooldown timestamp for the user

  // If the bot is mentioned, reply with a random sentence from the user's history
  if (message.mentions.has(client.user)) {
    const randomSentence = getRandomSentence(message.author.id);
    if (randomSentence.trim() !== '') {
      await message.reply(randomSentence); // Avoid empty replies
    }
  }

  // Respond with a formulated sentence using the learned words with a delay and 50/50 chance
  if (Math.random() > 0.5) {
    const numWords = Math.floor(Math.random() * 4) + 2;
    const selectedWords = [];
    while (selectedWords.length < numWords && learnedWords.length > 0) {
      const randomWord = learnedWords[Math.floor(Math.random() * learnedWords.length)];
      if (!selectedWords.includes(randomWord.word)) {
        selectedWords.push(randomWord.word);
      }
    }

    if (selectedWords.length > 1) {
      const sentence = selectedWords.join(' ') + '.';

      const delay = Math.floor(Math.random() * 2000) + 3000; // DELAY
      setTimeout(async () => {
        if (sentence.trim() !== '') { // Avoid empty sentences
          await message.reply(sentence);
        }
      }, delay);
    }
  }

  // Save the message to messageHistory
  if (!messageHistory[userId]) {
    messageHistory[userId] = [];
  }
  messageHistory[userId].push({ content: message.content, timestamp: message.createdTimestamp });

  // Save message history to file
  saveMessageHistory();

  // Command: help command
  if (message.content === '!help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('Bot Help')
      .setDescription('Here’s what I do:')
      .addFields(
        { name: 'Remember Messages', value: 'I recall all de vibes you send, mon!' },
        { name: 'Random Sentences', value: 'Me can drop sweet words from yuh messages, just like dat!' },
        { name: 'Role Assignment', value: 'When ya come in, I give you a rank like Boss or Captain!' },
        { name: 'Command Help', value: 'Me provide a list of commands like dis one right here!' }
      );

    await message.reply({ embeds: [helpEmbed] });
  }
});

// Function to get a random sentence from a user's message history
function getRandomSentence(userId) {
  if (messageHistory[userId] && messageHistory[userId].length > 0) {
    const randomIndex = Math.floor(Math.random() * messageHistory[userId].length);
    return messageHistory[userId][randomIndex].content;
  } else {
    return 'No history found.';
  }
}

// Save message history to file
function saveMessageHistory() {
  fs.writeFileSync(messageHistoryFilePath, JSON.stringify(messageHistory, null, 2));
}

// Login to the bot using your token
client.login(config.token);
