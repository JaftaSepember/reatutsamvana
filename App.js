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
  Dimensions,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Collapse, CollapseHeader, CollapseBody } from 'accordion-collapse-react-native';
import { HfInference } from '@huggingface/inference'
import OpenAI from "openai"

//localStorage.clear();
if(localStorage.getItem('token') === null){
  localStorage.setItem('token', '')
}

// if(localStorage.getItem('uploadedFiles') === null){
//   localStorage.setItem('uploadedFiles', JSON.stringify([]))
// }

const hf = new HfInference(localStorage.getItem('token'))
const openai = new OpenAI({ apiKey:localStorage.getItem('apiKey'), dangerouslyAllowBrowser: true})

const saveConversation = async (key, conversation) => {
  try {
    const name = conversation[conversation.length - 2].message
    if(conversation.length > 0){
      localStorage.setItem(key, JSON.stringify(conversation));
      localStorage.setItem(key + '_name', name);
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

  for (let i = 0; i < words.length; i += 500) {
    const chunk = words.slice(i, i + 500).join(' ');
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
  const top15Contents = similarities.slice(0, 5).map(obj => obj.content);
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
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(false);
  const [isDocLoading, setIsDocLoading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [seed, setSeed] = useState(Math.floor(Math.random() * 900000000 + 100000000));
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileContents, setFileContents] = useState([]);
  const [docChunks, setDocChunks] = useState([])
  const [contex, setContex] = useState('')
  const [totalDocs, setTotalDocs] = useState(0)
  const [useGpt, setUseGpt] = useState(false)
  const [isTutorial, setIsTutorial] = useState(false)
  const [isAbout, setIsAbout] = useState(false)
  const [titles, setTitles] = useState([])

  //docs
  const onFileChange = (event) => {
    const file = event.target.files[0];
    const newFiles = [...uploadedFiles, file]
    setUploadedFiles(newFiles);
    extractTextFromTxt(file);
  };

  const extractTextFromTxt = (file) => {
    const reader = new FileReader();

    reader.onload = () => {
      const text = reader.result;
      //.log(countWords(text))

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

  const saveChat = () => {
    saveKey(title)
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
      //localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles))
      console.log(fileContents)
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
    console.log(uploadedFiles)
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
    
    try{
      localStorage.removeItem(id);
      localStorage.removeItem(id+'_name');
      console.log('item: ' + id + ' was deleted')
      console.log('item: ' + id+'_name' + ' was deleted')
    } catch(error) {
      console.log('error deleting item: ' + error)
    }
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
        let query = []
        
        for(let i = 0; i < topK.length; i++){
          let re = await hf.questionAnswering({
            model: 'deepset/roberta-base-squad2',
            inputs: {
              question: inputMessage,
              context: topK[i] 
            }
          }) 
          query[query.length] = {score: re.score, answer: re.answer, content: topK[i]}
        }

        query.sort((a, b) => b.score - a.score);
        
        // for(let i = 0; i < 3; i++){
        //   document += query[i].content + '\n\n'
        // }
        // console.log(document)
        
        if(success === true){
          setIsLoading(true);
          const newMessage = { role: 'user', message: input };
          const updatedConversation = [...conversation, newMessage];
          setConversation(updatedConversation);

          let prevMessage = ''
          let prevResponse = ''
          let prevDocument = ''

          if(conversation.length > 1){
            for(let i = conversation.length - 1; i >= 0; i--){
              if(conversation[i].role === 'ai'){
                prevResponse = conversation[i].message
                prevMessage = conversation[i - 1].message
              }
            }
          } 

        let responses = []

        for(let i = 0; i < 3; i++){
          let res = await hf.textGeneration({
            //model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
            model: 'mistralai/Mistral-7B-Instruct-v0.1',
            inputs: `<s>[INST]Hello[/INST]
            Hi, How can I help you today?</s>
            [INST] Extract an answer for: '${input}' from: '${query[i].content}'.[/INST]`,
            parameters: {
              max_new_tokens: 250,
              temperature: 0.3
            }
          })
          responses[responses.length] = { role: 'ai', message: extractAnswer(res.generated_text, ".[/INST]"), source: query[i].content}
        }
        setInputMessage('');

        const aiResponse = responses;
        const updatedConversationWithAI = [...updatedConversation, aiResponse];
        setConversation(updatedConversationWithAI);
        saveConversation(seed, updatedConversationWithAI);
        //console.log(conversation)
        setIsLoading(false);
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

  const dummy = async () => {
    setIsLoading(true);
    let chunks = JSON.parse(localStorage.getItem('embeddings'))
        const vector = await hf.featureExtraction({
          model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
          inputs: [`${inputMessage}`,'']
        })
        const topK = cosineSimilarity(vector[0], chunks)
        let document = ''
        
        let re = await hf.questionAnswering({
          model: 'deepset/roberta-base-squad2',
          inputs: {
            question: inputMessage,
            context: topK[0] + '\n\n' +
            topK[1] + '\n\n' +
            topK[2] + '\n\n' +
            topK[3] + '\n\n' +
            topK[4] 
          }
        }) 

        for(let i = 0; i < topK.length; i++){
          if(topK[i].includes(re.answer)){
            document += topK[i] + '\n\n'
          }
        }
        console.log(document)

        //console.log(ans)
        setIsLoading(false);
  }
  //Send Message

  // const mode = localStorage.getItem('useGpt')
  //console.log(conversation)

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
          >
          {message.role === 'user' ? (
            <View 
              style={[
                styles.messageContainer,
                styles.userMessage
              ]}
            >
              <Text style={styles.messageText}>{message.message}</Text>
            </View>
          ) : (
            <AIMessage pages={message}/>
          )}
            
          </View>
        ))}
      </ScrollView>

      {conversation.length === 0 && (
        <View style={[styles.modal, {backgroundColor: 'black', borderColor: 'black'}]}>
          <Text style={[styles.text, { textAlign: "center", marginTop: 30, marginBottom: 30, color: 'white', fontWeight: 'bold', fontSize: 30}]}>You are ready to chat!</Text>
          <ScrollView>
            <Text style={[styles.text, { margin: 12, fontSize: 18, fontWeight: 'bold', color: 'white'}]}>
              You can can send your questions about the uploaded document(s) to Bubbles
            </Text>
            <Text style={[styles.text, { margin: 12, fontSize: 18, fontWeight: 'bold', color: 'white'}]}>
              Bubbles will respond with 3 answers and their sources from the document(s). Some or all answers can be incorrect. Use the provided sources to verify the answers. 
            </Text>
            <Text style={[styles.text, { margin: 12, fontSize: 18, fontWeight: 'bold', color: 'white'}]}>
              NB: Bubbles is a retrieval chatbot for single questions on documents and NOT a conversational chatbot like chatGPT, Bard, Bing Chat etc.
              Bubbles DOES NOT have memory, therefore you can not ask follow up questions  
            </Text>
          </ScrollView>
        </View>
      )}

      {(token.length > 10 && totalDocs === 0) && (
        <View style={[styles.modal, {backgroundColor: 'black', borderColor: 'black'}]}>
          <Text style={[styles.text, { textAlign: "center", marginTop: 30, marginBottom: 30, color: 'white', fontWeight: 'bold', fontSize: 30}]}>Welcome to Bubbles Chat!</Text>
          <ScrollView>
            <Text style={[styles.text, { margin: 12, fontSize: 18, fontWeight: 'bold', color: 'white'}]}>
              Click on the Documents button above and upload a document to start chatting.
            </Text>
            <Text style={[styles.text, { margin: 12, fontSize: 18, fontWeight: 'bold', color: 'white'}]}>
              NB: Only .txt files are supported, other formats need to be converted to .txt format. You can use tools like https://www.pdf2go.com/pdf-to-text 
            </Text>
          </ScrollView>
        </View>
      )}

      {isSideMenuOpen && (
        <View style={styles.sideMenu}>
          <TouchableOpacity onPress={handleNewChat}>
            <Text style={styles.newChat}>New Chat</Text>
          </TouchableOpacity>
          <Text style={[styles.text, { color: "gray", fontWeight: "bold", textAlign: "center", marginTop: 60}]}>--- History ---</Text>
          <ScrollView showsVerticalScrollIndicator={true}>
            {keyIDs.map((ID, index) => (
              <View key={index} style={{flexDirection: "row", justifyContent: "space-between", alignItems: "center"}}>
                <TouchableOpacity style={[styles.text, {width: '80%',marginRight: 0}]} onPress={() => handleHistoryItem(ID)}>
                  <Text style={styles.messageText}>{localStorage.getItem(ID+'_name')}</Text>
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
              <ScrollView>
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

      {token.length < 10 && (
        <View style={[styles.modal, {backgroundColor: 'black', borderColor: 'black'}]}>
          <Text style={[styles.text, { textAlign: "center", marginTop: 30, marginBottom: 30, color: 'white', fontWeight: 'bold', fontSize: 30}]}>Welcome to Bubbles Chat!</Text>
          <ScrollView>
            <Text style={[styles.text, { margin: 12, fontSize: 18, fontWeight: 'bold', color: 'white'}]}>
              It seems like you haven't set the Huggingface Access Token,
            </Text>
            <Text style={[styles.text, { margin: 12, fontSize: 18, fontWeight: 'bold', color: 'white'}]}>
              Click on the setting button on the top right corner and set your Huggingface Access Token.

              You can read more about Huggingface access tokens and how to create one at:
              huggingface.co/docs/hub/security-tokens

            </Text>
          </ScrollView>
        </View>
      )}

      {isSettingsMenuOpen && (
        <View style={styles.settingsMenu}>
          <Text style={[styles.text, { color: "gray", fontWeight: "bold", textAlign: "center", marginTop: 30, marginBottom: 30}]}>--- Settings ---</Text>
          <ScrollView>
          <Divider/>  
            <Text style={[styles.text, {margin: 6, marginStart: 0}]}>Huggingface Access Token</Text>
            <View style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 24}}>
              <TextInput
                style={{height: 30, backgroundColor: 'white', width: '70%'}}
                value={token}
                onChangeText={(text) => setToken(text)}
                secureTextEntry='true'
              />
              <TouchableOpacity style={{marginStart: 6}} onPress={() => {
                localStorage.setItem('token', token)
              }}> 
                <Text style={styles.sendButton}>Set token</Text>
              </TouchableOpacity>
            </View>
            
            <Divider/>
            <TouchableOpacity style={{marginStart: 6, marginTop: 30}} onPress={() => {
              setIsAbout(true)
            }}> 
              <Text style={[styles.text, {margin: 6, marginStart: 0}]}>About</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {isEmbedding && (
        <View style={[styles.modal, { backgroundColor: 'black', borderColor: 'black'}]}>
          <ActivityIndicator color="white" size="large" />
          <Text style={[styles.text, { fontSize: 24, margin: 12, fontweight: 'bold'}]}>Bubbles is updating your documents, please wait...</Text>
          <Text style={[styles.text, { fontSize: 14, margin: 10}]}>(This may take a few minutes)</Text>
        </View>
      )}

      {isAbout && (
        <View style={[styles.settingsMenu, {backgroundColor: 'black', borderColor: 'white'}]}>
          <View style={{ flexDirection: 'row', width: '100%' ,justifyContent: 'flex-end'}}>
            <TouchableOpacity  onPress={() => {
              setIsAbout(false)
            }}>
              <Text style={[styles.text, { backgroundColor: 'crimson', padding: 6,borderRadius: 8, margin: 0}]}>Close</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.text, { textAlign: "center", marginTop: 30, marginBottom: 30, fontSize: 18}]}>--- About ---</Text>
          <ScrollView>
            <Text style={[styles.text, { margin: 12, fontSize: 18}]}>
              {about}
            </Text>
          </ScrollView>
        </View>
      )}

      {isTutorial && (
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
        {/* <TouchableOpacity onPress={() => handleSendMessage(inputMessage)} disabled={isLoading}>
        //   {isLoading ? (
        //     <ActivityIndicator color="blue" size="small" />
        //   ) : (
        //     <Text style={styles.sendButton}>Send</Text>
        //   )}
        // </TouchableOpacity>*/}
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








const Divider = () => {
  return(
    <View style={{height: 1, width: '100%', borderWidth: 1, borderColor: 'gray', marginVertical: 30}}>

    </View>
  )
}

const AIMessage = ({ pages }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isCollapseOpen, setIsCollapseOpen] = useState(false);

  const nextPage = () => {
    setCurrentPage((prevPage) => Math.min(prevPage + 1, pages.length - 1));
  };

  const prevPage = () => {
    setCurrentPage((prevPage) => Math.max(prevPage - 1, 0));
  };

  const toggleCollapse = () => {
    setIsCollapseOpen(!isCollapseOpen);
  };

  return (
    <View style={[styles.messageContainer, styles.aiMessage]}>
      
      <Text style={[styles.messageText, { color: 'white'}]}>{pages[currentPage].message}</Text>

      <Collapse style={styles.collapseContainer} onToggle={toggleCollapse}>
        <CollapseHeader>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between'}}>
            <Text style={[styles.messageText, { fontSize: 16, padding: 6, color: 'white', borderRadius: 8, backgroundColor: 'royalblue', }]}>{isCollapseOpen ? 'Hide Source' : 'Show Source'}</Text>
          </View>
        </CollapseHeader>
        <CollapseBody>
          <Text style={[styles.messageText, { color: 'white'}]}>{pages[currentPage].source}</Text>
        </CollapseBody>
      </Collapse>

      <View style={styles.buttonContainer}>
        <Ionicons
          name="arrow-back"
          size={32}
          color={currentPage === 0 ? 'gray' : 'white'}
          onPress={prevPage}
          style={{
            padding: 3,
            borderRadius: 8,
            backgroundColor: 'dodgerblue'
          }}
        />
        <Ionicons
          name="arrow-forward"
          size={32}
          color={currentPage === pages.length - 1 ? 'gray' : 'white'}
          onPress={nextPage}
          style={{
            padding: 3,
            borderRadius: 8,
            backgroundColor: 'royalblue'
          }}
        />
      </View>
    </View>
  );
};

const contentz = `Anela Myalatya (Mr. M): A 57-year-old black South African
teacher at Zolile High School, he believes that education is the
most powerful tool in the struggle for freedom and equality.

In a classroom of the black Zolile High, Mr. M referees a student debate contesting that women
should not receive the same education as men. In favor is Thami, one of Mr. M's favorite and most
promising students. In opposition is Isabel, a white student visiting from an all-girls school. Mr. M sees
potential in the intellectual pairing of Isabel and Thami, and brings them together as a team for the
statewide English literature competition. As they prepare under Mr. M's tutelage, Isabel gains immense
respect and admiration for Mr. M and forms a deep friendship with Thami. Outside the classroom Mr.
M's hopes for Thami are challenged by their generational divide and increasing political unrest under
the South African government’s policy of apartheid. Thami quits the competition when he joins a
student movement to boycott the school until blacks are given an education equivalent to that of
whites. The tradition-bound Mr. M regards Thami’s actions as destructive and cooperates with the
white police by informing against the boycotting students. Thami’s comrades retaliate; a mob
approaches Zolile High School, intending to kill Mr. M for his betrayal. Thami tries to help Mr. M
escape by offering to vouch for Mr. M’s innocence, but Mr. M refuses the protection of a lie and stands
his ground. The mob kills him.

Though not his first play, in 1961 it was The Blood Knot that earned Fugard international attention
as a playwright. Not all of the attention was positive: after only one performance, the play was banned in
South Africa. When Fugard joined a boycott of segregated theatre audiences, the South African
government placed restrictions on his movements and the Secret Police began surveillance of his theatre
company. They would later confiscate Fugard's passport, and it would take an international protest to allow
him to fly to England to direct one of his plays years later. 

Timeline: The History of Apartheid in South Africa
1497 - Vasco De Gama, Portugese explorer, lands on the Natal Coast
1652 - The Dutch East India Company founds Cape Colony
1806 - The Dutch cede the territory to the British
1800s- British colonial powers war with the Boers and Zulus, encouraged by the discovery of gold in
Transvaal
1902 - The fighting ends, Transvaal and Orange Free State become self-governing colonies
1910 - The Boer republics of Transvaal and Orange Free State join with British colonies Cape and
Natal, creating the Union of South Africa
1912 - Native National Congress is founded (later the African National Congress, or ANC)
1913 Land Act prevents blacks outside of Cape Province buying land except in designated reserves
1914 - National Party is founded (made up of Afrikaaners, the descendents of the Dutch colonial
powers)
1919 - South West Africa (Namibia) comes under South African control
1948 - National Party takes power and imposes a policy of apartheid, or 'separateness'. The population
of South Africa was categorized and registered by race, and the Group Areas Act segregated residential
communities (sometimes forcibly), with blacks driven to specified townships.

Which of these events would terrify you? Which resonate with what you know of the American Civil
Rights movement?
What would it be like to live in South Africa in 1920? 1950? 1990? Now? 





`

const about = `© Copyright 2023, Jafta September.

Disclaimer: 
Bubbles can generate incorrect information with high confidence. Verify the answers with the provided sources.

• Bubbles is a retrieval Chatbot that uses Huggingface open source models on free inference to retrieve answers to user questions about the content of .txt documents

• Bubbles can be a useful tool for document information retrieval with a quick and simple way to verify correct and incorrect information

• Documents are stored on current session memory only(update coming soon)

• Other future Updates: Support for memory. 

• Users are required to use their own huggingface access token until further notice from the developer.
• contact developer at BubblesAIChatbot@gmail.com 
  
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
    maxWidth: '90%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'darkslateblue',
    borderBottomRightRadius: 0
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'black',
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginVertical: 30,
  },
  collapseContainer: {
    width: '80%',
    marginTop: 20,
  },
});

export default Chatbot;