import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Button,
  FlatList,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HfInference } from '@huggingface/inference'

//localStorage.clear();

const hf = new HfInference('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')

const saveConversation = async (key, conversation) => {
  try {
    if(conversation.length > 0){
      localStorage.setItem(key, JSON.stringify(conversation));
    }

  } catch (error) {
    console.error('Error saving conversation:', error);
  }
};

const saveKeys = async (key) => {
  try { 
    let keys = localStorage.getItem("vggt");
    if(keys === null) {
      localStorage.setItem("vggt", key);
    }
    else {
      keys = keys + "-" + key
      localStorage.setItem("vggt", keys);
    }
  } catch (error) {
    console.error('Error saving key:', error);
  }
};

function extractKeys(inputString) {
  

  const linesArray = inputString.split("-");

  const filteredArray = linesArray.filter(item => item !== '');
  const filteredArray2 = filteredArray.filter(Boolean);
  const trimmedLinesArray = filteredArray2.map(line => line.trim());

  return trimmedLinesArray.reverse();
}

function extractAnswer(inputString, searchWord) {
  const lastIndex = inputString.lastIndexOf(searchWord);
  if (lastIndex !== -1) {
    const resultSubstring = inputString.substring(lastIndex + searchWord.length);

    return resultSubstring;
  } else {
    return "Search word not found in the string.";
  }
}

function splitStringIntoChunks(inputString) {
  const words = inputString.split(/\s+/);

  const chunks = [];

  for (let i = 0; i < words.length; i += 200) {
    const chunk = words.slice(i, i + 200).join(' ');
    chunks.push(chunk);
  }

  return chunks;
}

function splitIntoSentences(paragraph) {
  // Define a regular expression to match sentence-ending punctuation
  const sentenceRegex = /[^.!?]*[.!?]/g;

  // Use the regular expression to split the paragraph into an array of sentences
  const sentences = paragraph.match(sentenceRegex);

  // Remove leading and trailing whitespaces from each sentence
  const trimmedSentences = sentences.map(sentence => sentence.trim());

  // Iterate through the sentences to append short sentences
  for (let i = 0; i < trimmedSentences.length - 1; i++) {
    const currentSentence = trimmedSentences[i];
    const nextSentence = trimmedSentences[i + 1];

    // Check if the current sentence has less than 5 words
    if (currentSentence.split(/\s+/).length < 10) {
      // Append the current sentence to the next sentence
      trimmedSentences[i + 1] = `${currentSentence} ${nextSentence}`;
      // Remove the current sentence from the array
      trimmedSentences.splice(i, 1);
      // Adjust the loop counter to reprocess the current index
      i--;
    }
  }

  return trimmedSentences;
} 

function splitIntoParagraphs(essay) {
  // Define a regular expression to match paragraph delimiters (double line breaks)
  const paragraphRegex = /[\r\n]{2,}/;

  // Use the regular expression to split the essay into an array of paragraphs
  const paragraphs = essay.split(paragraphRegex);

  // Remove leading and trailing whitespaces from each paragraph
  const trimmedParagraphs = paragraphs.map(paragraph => paragraph.trim());

  return trimmedParagraphs;
}

function countWords(inputString) {
  // Remove leading and trailing whitespaces
  const trimmedString = inputString.trim();

  // Split the string into an array of words using space as the delimiter
  const wordsArray = trimmedString.split(/\s+/);

  // Return the number of words in the array
  return wordsArray.length;
}

function isLowerCaseDominated(inputString) {
  // Count the number of lowercase letters
  const lowerCaseCount = (inputString.match(/[a-z]/g) || []).length;

  // Count the total number of characters
  const totalCharacters = inputString.length;

  // Compare the counts and return true if lowercase letters are more, else false
  return lowerCaseCount > totalCharacters / 2;
}




























const Chatbot = () => {
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isDocsMenuOpen, setIsDocsMenuOpen] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [keyIDs, setKeyIDs] = useState([]);
  const [history, setHistory] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDocLoading, setIsDocLoading] = useState(false);
  const [seed, setSeed] = useState(Math.floor(Math.random() * 900000000 + 100000000));
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileContents, setFileContents] = useState([]);
  const [docChunks, setDocChunks] = useState([])
  const [contex, setContex] = useState('')
  const [displayedText, setDisplayedText] = useState('');

  //docs
  const onFileChange = (event) => {
    const file = event.target.files[0];
    setUploadedFiles([...uploadedFiles, file]);
    extractTextFromTxt(file);
    
  };

  const extractTextFromTxt = (file) => {
    const reader = new FileReader();

    reader.onload = () => {
      const text = reader.result;
      
      setDocChunks(splitIntoParagraphs(text))

      const newFileContent = { name: file.name, content: text };
      setFileContents((prevFileContents) => [...prevFileContents, newFileContent]);
    };

    reader.readAsText(file);
  };

  const deleteFile = (index) => {
    const deletedFile = uploadedFiles[index];
    const newFiles = uploadedFiles.filter((file, i) => i !== index);
    setUploadedFiles(newFiles);

    setFileContents((prevFileContents) =>
      prevFileContents.filter((fileContent) => fileContent.name !== deletedFile.name)
    );
  };

  const combineContents = () => {
    return fileContents.map((fileContent) => fileContent.name + ':\n' + fileContent.content + '\n\n').join('');
  };
  //docs








  //history
  const generateKey = () => {
      setSeed(Math.floor(Math.random() * 900000000 + 100000000));
      loadConversation();
      setIsSideMenuOpen(false)
  }

  const handleNewChat = () => {
    generateKey()

  }

  useEffect(() => {
    if(localStorage.getItem("vggt") === null){
      localStorage.setItem("vggt", seed)
    }

    if(!localStorage.getItem("vggt").includes(seed) && conversation.length > 0){
      saveKeys(seed) 
      loadConversation(seed);
    }

    if(docChunks.length === 0){
      setIsDocLoading(true)
    } 
    
    if(docChunks.length > 0) {
      setIsDocLoading(false)
    }
  }, [seed, conversation, docChunks]);

  const toggleSideMenu = () => {
    getKeys() 
    setIsSideMenuOpen(!isSideMenuOpen);
    loadConversation(seed);
    setIsLoading(false);
  };

  const toggleDocuments = () => {
    getKeys() 
    setIsDocsMenuOpen(!isDocsMenuOpen);
    loadConversation(seed);
    setIsLoading(false);
  };

  const getKeys = async () => {
    try { 
      let keys = localStorage.getItem("vggt");
      if(keys !== null) {
        setKeyIDs(extractKeys(keys))
        // console.log(extractKeys(keys))
      }
    } catch (error) {
      console.error('Error saving key:', error);
    }
  };

  const loadConversation = async (k) => {
    try {
      const savedConversation = localStorage.getItem(k);
      if (savedConversation !== null) {
        setConversation(JSON.parse(savedConversation));
      }
      else{
        setConversation([])
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const handleDeleteItem = (index, id) => {
    const updatedKeyIDs = [...keyIDs];
    const newValue = localStorage.getItem("vggt").replaceAll(id, '').replaceAll('--', '-')
    localStorage.setItem("vggt", newValue)
    updatedKeyIDs.splice(index, 1); 
    setKeyIDs(updatedKeyIDs);
  }

  const handleHistoryItem = (id) => {
    setSeed(id)
    toggleSideMenu()
    loadConversation(id);
  }
  //history







  //Send Message
  
  const embedd = async () => {
    setIsLoading(true);
    const scores = await hf.sentenceSimilarity({
      model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      inputs: {
        source_sentence: `${inputMessage}`,
        sentences: docChunks
      }
    })

    let arr = []

    for (let i = 0; i < docChunks.length; i++){
      if(isLowerCaseDominated(docChunks[i])){
        arr[i] = {score: scores[i], content: docChunks[i]}
      } 
    }
  
    arr.sort((a, b) => b.score - a.score);
    let _contex = ''

    if (arr.length < 25){
      for (let i = 0; i < arr.length; i++){
        _contex += arr[i].content + '\n\n'
      }
    } else {
      for (let i = 0; i < 25; i++){
        _contex += arr[i].content + '\n\n'
      }
    }

    setContex(_contex)
    console.log('local: ' + _contex)
    handleSendMessage(inputMessage, _contex)
  }

  const handleSendMessage = async (input, contx) => {
    const success = true
    if (inputMessage.trim() !== '') {
        if(success === true){
          setIsLoading(true);
          const newMessage = { role: 'user', message: input };
          const updatedConversation = [...conversation, newMessage];
          setConversation(updatedConversation);
          

          let res = await hf.textGeneration({
            model: 'mistralai/Mistral-7B-Instruct-v0.1',
            //model: 'tiiuae/falcon-7b-instruct',
            inputs: `<s>[INST] Use the document below to answer user questions.
            
            document:
              ${contx}.[/INST]
            Got it. You may ask me any question about the document and I will provide accurate answers</s>
            [INST] According to the document, ${input}.[/INST].`,
            parameters: {
              max_new_tokens: 8000,
              temperature: 0.1 
            }
          })
      
        //console.log(res.generated_text)

        const aiResponse = { role: 'ai', message: extractAnswer(res.generated_text, ".[/INST].")};
        const updatedConversationWithAI = [...updatedConversation, aiResponse];
        setConversation(updatedConversationWithAI);
        setInputMessage('');
        setIsLoading(false);
        saveConversation(seed, updatedConversationWithAI)
      }
    }
  };

  const dummy = async () => {
    handleSendMessage(inputMessage)
  }
  //Send Message

  // if(docChunks.length > 0){
  //   console.log(docChunks)
  // }

  return (
    <View style={styles.container} key={seed}>
      <View style={styles.header}>
        <TouchableOpacity onPress={toggleSideMenu}>
          <Text style={styles.sideMenuButton}>☰</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.newChat,{flexDirection: 'row', padding: 0}]} onPress={toggleDocuments}>
          <Ionicons
            name="book"
            size={16}
            color="white"
            style={{
              paddingTop: 12,
              marginHorizontal: 6
            }}
          />
          <Text style={styles.newChat}>Documents</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.chatContainer}
        ref={(ref) => {
          this.scrollView = ref;
        }}
        onContentSizeChange={() => {
          this.scrollView.scrollToEnd({ animated: true });
        }}
      >
        {conversation.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageContainer,
              message.role === 'user' ? styles.userMessage : styles.aiMessage,
            ]}
          >
            <Text style={styles.messageText}>{message.message}</Text>
          </View>
        ))}
      </ScrollView>

      {isSideMenuOpen && (
        <View style={styles.sideMenu}>
          <TouchableOpacity onPress={handleNewChat}>
            <Text style={styles.newChat}>New Chat</Text>
          </TouchableOpacity>
          <Text style={[styles.text, { color: "gray", fontWeight: "bold", textAlign: "center", marginTop: 60}]}>--- History ---</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {keyIDs.map((ID, index) => (
              <View key={index} style={{flexDirection: "row", justifyContent: "space-between", alignItems: "center"}}>
                <TouchableOpacity style={styles.text} onPress={() => handleHistoryItem(ID)}>
                  <Text style={styles.messageText}>{ID}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteItem(index, ID)}>
                  <Ionicons
                    name="trash"
                    size={16}
                    color="red"
                    style={{ 
                      margin: 16
                    }}
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {isDocsMenuOpen && (
        <View style={styles.docMenu}>
            <label htmlFor="upload-file" style={styles.newDoc}>
              UPLOAD FILE
            </label>
            <input
              type="file"
              id="upload-file"
              onChange={onFileChange}
              accept=".txt"
              style={{ display: 'none' }}
            />
            <Text style={[styles.text, { color: "gray", fontWeight: "bold", textAlign: "center", marginTop: 60}]}>--- Documents ---</Text>
            {uploadedFiles.length > 0 && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {uploadedFiles.map((file, index) => (
                  <View key={index} style={{flexDirection: "row", justifyContent: "space-between", alignItems: "center"}}>
                    <Text style={styles.messageText}>{file.name}{' '}</Text>
                    <TouchableOpacity onPress={() => deleteFile(index)}>                     
                      {isDocLoading ? (
                        <ActivityIndicator color="blue" size="small" />
                      ) : (
                        <Ionicons
                          name="trash"
                          size={16}
                          color="red"
                          style={{ 
                            margin: 16
                          }}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputMessage}
          onChangeText={(text) => setInputMessage(text)}
          placeholder="type your message..."
          onSubmitEditing={handleSendMessage}
          editable={!isLoading}
          multiline

        />
        <TouchableOpacity onPress={embedd} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="blue" size="small" />
          ) : (
            <Text style={styles.sendButton}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const context = `
context:
`












const styles = StyleSheet.create({
  container: {
    height: Dimensions.get('window').height,
    backgroundColor: "black",
    maxHeight: Dimensions.get('window').height
  },
  text: {
    fontSize: 16,
    fontWeight: "400",
    textAlign: "flex-start",
    color: "white",
    margin: 16
  },
  newChat: {
    fontSize: 16,
    fontWeight: "400",
    backgroundColor: "royalblue",
    borderRadius: 6,
    textAlign: "center",
    padding: 6,
    color: "white"
  },
  newDoc: {
    fontSize: 16,
    fontWeight: "400",
    backgroundColor: "green",
    borderRadius: 6,
    textAlign: "center",
    padding: 6,
    color: "white",
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 20,
    marginBottom: 12
  },
  sideMenuButton: {
    fontSize: 24,
    fontWeight: 'bold',
    color: "white"
  },
  chatContainer: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 15,
    //position: "relative"
  },
  messageContainer: {
    maxWidth: '70%',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'royalblue',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'darkslateblue',
  },
  messageText: {
    fontSize: 16,
    fontWeight: "400",
    color: "white"
  },
  sideMenu: {
    position: 'absolute',
    top: 60,
    left: 30,
    right: 30,
    bottom: 130,
    //width: '90%',
    backgroundColor: 'black',
    paddingTop: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderTopLeftRadius: 0,
    borderWidth: 1,
    borderColor: "white"
    
  },
  docMenu: {
    position: 'absolute',
    top: 60,
    left: 30,
    right: 30,
    bottom: 130,
    backgroundColor: 'black',
    paddingTop: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderTopRightRadius: 0,
    borderWidth: 1,
    borderColor: "white"
    
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginVertical: 12
  },
  input: {
    flex: 1,
    borderColor: 'gray',
    borderWidth: 0,
    borderRadius: 6,
    paddingHorizontal: 15,
    marginRight: 10,
    height: 80,
    backgroundColor: "white",
    fontWeight: "400",
    fontSize: 16,
    paddingTop: 12
  },
  sendButton: {
    color: 'blue',
    fontWeight: 'bold',
  },
});

const containerStyle = {
  background: 'black',
  padding: '20px',
  textAlign: 'center',
  flex: 1,
  alignItems: "center"
};

const uploadButtonStyle = {
  padding: '10px 20px',
  background: '#3498db',
  color: 'white',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '16px',
  fontWeight: 400,
  width:"80%"
};

const fileListStyle = {
  listStyleType: 'none',
  padding: 0,
  color: 'white',
};

const contentStyle = {
  background: '#333',
  color: 'white',
  padding: '10px',
  borderRadius: '4px',
  overflowX: 'auto',
};

export default Chatbot;