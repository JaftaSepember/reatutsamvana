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

const hf = new HfInference(`${localStorage.getItem('apiKey')}`)

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

  for (let i = 0; i < words.length; i += 25) {
    const chunk = words.slice(i, i + 25).join(' ');
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

function cosineSimilarity(queryVector, arrayOfObjects) {
  // Function to calculate the cosine similarity between two vectors
  function calculateCosineSimilarity(v1, v2) {
    const dotProduct = v1.reduce((acc, val, i) => acc + val * v2[i], 0);
    const magnitude1 = Math.sqrt(v1.reduce((acc, val) => acc + val ** 2, 0));
    const magnitude2 = Math.sqrt(v2.reduce((acc, val) => acc + val ** 2, 0));
    return dotProduct / (magnitude1 * magnitude2);
  }

  // Calculate cosine similarity for each object
  const similarities = arrayOfObjects.map(obj => ({
    content: obj.content,
    similarity: calculateCosineSimilarity(queryVector, obj.score),
  }));

  // Sort the objects based on similarity in descending order
  similarities.sort((a, b) => b.similarity - a.similarity);

  // Return the top 15 contents
  const top15Contents = similarities.slice(0, 12).map(obj => obj.content);
  return top15Contents;
}




























const Chatbot = () => {
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isDocsMenuOpen, setIsDocsMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [keyIDs, setKeyIDs] = useState([]);
  const [history, setHistory] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDocLoading, setIsDocLoading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [seed, setSeed] = useState(Math.floor(Math.random() * 900000000 + 100000000));
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileContents, setFileContents] = useState([]);
  const [docChunks, setDocChunks] = useState([])
  const [contex, setContex] = useState('')
  const [totalDocs, setTotalDocs] = useState(0)

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

    if(fileContents.length === 0){
      setIsDocLoading(true)
    } 
    
    if(fileContents.length > 0) {
      setIsDocLoading(false)
    }

    if(totalDocs !== fileContents.length){
      createEmbeddings()
      setTotalDocs(fileContents.length)
    }
  }, [seed, conversation, fileContents, totalDocs]);

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

  const toggleSettings = () => {
    getKeys() 
    setIsSettingsMenuOpen(!isSettingsMenuOpen);
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
    setIsLoading(true)
    setIsEmbedding(true)
    let chunks = JSON.parse(localStorage.getItem('chunks'))

    const scores = await hf.featureExtraction({
      model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      inputs: chunks
    })

    let newEmbeddings = []

    for (let i = 0; i < chunks.length; i++){
      if(isLowerCaseDominated(chunks[i]) && countWords(chunks[i]) > 10){
        newEmbeddings[i] = {score: scores[i], content: chunks[i]}
      } 
    }

    newEmbeddings = newEmbeddings.filter(item => item !== '').filter(item => item !== null);
    localStorage.setItem('embeddings', JSON.stringify(newEmbeddings)) 

    //console.log(newEmbeddings)
    setIsLoading(false)
    setIsEmbedding(false)
  }

  const handleSendMessage = async (input) => {
    setIsLoading(true)
    const success = true
    if(inputMessage.trim() !== '') {
        let chunks = JSON.parse(localStorage.getItem('embeddings'))
        const vector = await hf.featureExtraction({
          model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
          inputs: [`${inputMessage}`,'']
        })
        const topK = cosineSimilarity(vector[0], chunks)
        let document = ''
        
        for(let k = 0; k < topK.length; k++){
          document += topK[k] + '\n\n'
        }
        
        if(success === true){
          setIsLoading(true);
          const newMessage = { role: 'user', message: input };
          const updatedConversation = [...conversation, newMessage];
          setConversation(updatedConversation);
          

          let res = await hf.textGeneration({
            model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
            //model: 'tiiuae/falcon-7b-instruct',
            inputs: `<s>[INST] You are Bubbles, an ai-document-QnA chatbot developed by Jafta September.

            Your job is to answer the user's questions strictly using the document provided below. If the answer is not found in the document, Tell the user that the answer is not mentioned in the document and therefore you cannot respond to it. The user may refer to the document as paper, book, report, article, block, context, content or any other related word.

            Only respond to greetings and questions that have answers that are explicitly mentioned in the provided document. For any other types of questions or requests (e,g 'write a poem', 'write code', 'generate a story' etc.), tell the user that you are not programmed to respond to that, you only answer questions based on the provided documents.

            <document>
              ${document}
            </document> [/INST]
            Got it. I will follow these rules 100% without making any mistakes. </s>
            [INST]According to the document,  ${input}.[/INST].`,
            parameters: {
              max_new_tokens: 8000,
              temperature: 0.3 
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

  const createEmbeddings = async () => {
    let c = ''
    let a = []

    for(let i = 0; i < fileContents.length; i++){
      c += fileContents[i].content + `\n\n` 
    }

    setDocChunks(splitIntoParagraphs(c))
    localStorage.setItem('chunks', JSON.stringify(splitIntoParagraphs(c)))
    embedd()
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
        <TouchableOpacity onPress={toggleSettings}>
          <Ionicons
            name="settings"
            size={24}
            color="white"
            style={{
              paddingTop: 6,
              marginHorizontal: 6
            }}
          />
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
          <ScrollView showsVerticalScrollIndicator={true}>
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

      {isSettingsMenuOpen && (
        <View style={styles.settingsMenu}>
          <Text style={[styles.text, { color: "gray", fontWeight: "bold", textAlign: "center", marginTop: 30, marginBottom: 30}]}>--- Settings ---</Text>
          <ScrollView>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <Text style={[styles.text, {margin: 6}]}>API KEY</Text>
              <TextInput
                style={{height: 30, backgroundColor: 'white', width: '50%'}}
                value={apiKey}
                onChangeText={(text) => setApiKey(text)}
                secureTextEntry='true'
              />
              <TouchableOpacity onPress={() => {
                localStorage.setItem('apiKey', apiKey)
              }}> 
                <Text style={styles.sendButton}>Set</Text>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </View>
      )}

      {isEmbedding && (
        <View style={styles.modal}>
          <ActivityIndicator color="white" size="large" />
          <Text style={[styles.text, { fontSize: 20, margin: 12}]}>Bubbles is preparing your document, please wait...</Text>
          <Text style={[styles.text, { fontSize: 14, margin: 10}]}>(This may take a minute or a few.)</Text>
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
        <TouchableOpacity onPress={() => handleSendMessage(inputMessage)} disabled={isLoading}>
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
    padding: 16,
    marginBottom: 16,
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
    //borderTopRightRadius: 0,
    borderWidth: 1,
    borderColor: "white"
    
  },
  settingsMenu: {
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
  modal: {
    position: 'absolute',
    top: 60,
    left: 30,
    right: 30,
    bottom: 130,
    backgroundColor: 'orange',
    paddingTop: 20,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "orange",
    alignItems: 'center',
    justifyContent: 'center'
    
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