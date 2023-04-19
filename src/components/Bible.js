import React, { useState, useEffect, useContext } from "react";
import "../styles.css";
import Card from "@material-ui/core/Card";
import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import { AppContext } from '../App.context';

import BibleReference, { useBibleReference } from 'bible-reference-rcl';
import { renderHTML } from '../utils/printPreview';
import { Proskomma } from 'proskomma';
import { clearCaches, getFileCached } from '../utils/dcsCacheUtils'
import * as books from '../common/books';


export default function Bible(props) {
  // state variables
  const [contentStatus, setContentStatus] = useState("Waiting...");
  const [booksToImport, setBooksToImport] = useState([]);
  const [importedBooks, setImportedBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pk, setPk] = useState(new Proskomma());

  // app context
  const {
    state: {
      resourceInfo,
    },
    actions: {
      setPrintPreview,
      setHtml,
    }
  } = useContext(AppContext)

  // deconstructed parameters
  const {
    onChange,
    style,
  } = props || {};

  const { state: bibleReferenceState, actions: bibleReferenceActions } = useBibleReference({
    initialBook: resourceInfo.bibleReference.book,
    initialChapter: resourceInfo.bibleReference.chapter,
    initialVerse: resourceInfo.bibleReference.verse,
    supportedBooks: resourceInfo.supportedBooks,
    onChange
  });

  const handlePrint = () => {
    setPrintPreview(true)
  };

  const handleLoadAll = () => {
    const books = [];
    console.log(resourceInfo.supportedBooks);
    resourceInfo.supportedBooks.forEach(bookId => {
      if (!importedBooks.includes(bookId))
        books.push(bookId);
    })
    setBooksToImport(books);
  };

  const handleClearBooks = () => {
    clearCaches();
    setImportedBooks([]);
    setPk(new Proskomma());
  }

  useEffect(() => {
    if (!booksToImport.includes(bibleReferenceState.bookId) && !importedBooks.includes(bibleReferenceState.bookId)) {
      setBooksToImport([...booksToImport, bibleReferenceState.bookId]);
    }
  }, [bibleReferenceState.bookId, booksToImport, importedBooks, setBooksToImport]);

  useEffect(() => {
    const fetchContent = async () => {
      for(let i = 0; i < booksToImport.length; i++) {
        const bookId = booksToImport[i];
        if (!importedBooks.includes(bookId)) {
          let status = "Loading: " + bookId;
          setContentStatus(status);
          console.log(status);
          let filename;
          if (resourceInfo.isTcRepo)
            filename = resourceInfo.repo + '.usfm';
          else
            filename = books.usfmNumberName(bookId) + '.usfm';
          const content = await getFileCached({ username: resourceInfo.owner, repository: resourceInfo.repo, path: filename, ref: resourceInfo.commitID });
          status = "Book Retrieved from DCS: " + bookId;
          setContentStatus(status);
          console.log(status);
          try {
            let status = `Importing into Proskomma: ${bookId}...`;
            setContentStatus(status)
            console.log(status);
            const lang = (resourceInfo.language === "en" ? "eng" : resourceInfo.language);
            pk.importDocument(
              {lang, abbr: resourceInfo.resource},
              "usfm",
              content,
            );
            status = `Imported into Proskomma: ${bookId}${(i === (booksToImport.length-1)?"; Rendering HTML...":"")}`;
            setContentStatus(status);
            console.log(status);
            setImportedBooks(pk.documentList().map(doc => ('bookCode' in doc.headers ? doc.headers['bookCode'].toLowerCase() : "")));
          } catch (e) {
              console.log("ERROR pk.importDouments: ", e);
          }
        }
      }
      setBooksToImport([]);
      setLoading(false);
    }

    if (booksToImport.length && ! loading) {
      setLoading(true);
      fetchContent().catch(console.error);
    }
  }, [pk, resourceInfo, loading, importedBooks, booksToImport]);

  useEffect(() => {
    const handleHTML = async () => {
      const html = await renderHTML({
        proskomma: pk,
        language: (resourceInfo.language === "en" ? "eng" : resourceInfo.language),
        resource: resourceInfo.resource,
        title: resourceInfo.title,
        textDirection: resourceInfo.textDirection,
        books: importedBooks,
      });
      // console.log("doRender html is:", html.output); // the object has some interesting stuff in it
      setHtml(html.output);
      setContentStatus("Rendered HTML");
    };

    if (!booksToImport.length && importedBooks.length && ! loading) {
      handleHTML().catch(console.error);
    }
  }, [pk, resourceInfo, loading, booksToImport, importedBooks, setHtml]);

  return (
    <div>
      <br />
      <br />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          // justifyContent: "center"
        }}
      >
        <BibleReference status={bibleReferenceState} actions={bibleReferenceActions} style={style} />
      </div>

      <br />
      <br />

      <Card variant="outlined">
        <CardContent>
          <Typography
            color="textPrimary"
            gutterBottom
            display="inline"
          >
            <b>{`Owner:`}</b> {resourceInfo.owner} <b>{"Repo:"}</b> {resourceInfo.repo} <b>{resourceInfo.refType + ":"}</b> {resourceInfo.ref}{(resourceInfo.refType !== "Commit" ? " (" + resourceInfo.commitID + ")" : "")} <a href={`https://git.door43.org/${resourceInfo.owner}/${resourceInfo.repo}/src/branch/${resourceInfo.ref}`} target={"_blank"} rel={"noopener noreferrer"} style={{ fontSize: "12px" }}>{"See on DCS"}</a>
          </Typography>
        </CardContent>
        <CardActions>
          <Button variant="outlined" id="prev_b" onClick={bibleReferenceActions.goToPrevBook}>
            {"Previous Book"}
          </Button>

          <Button variant="outlined" id="next_b" onClick={bibleReferenceActions.goToNextBook}>
            {"Next Book"}
          </Button>

          <Button variant="outlined" id="load_all" onClick={handleLoadAll}>
            {"Load All Books"}
          </Button>

          <Button variant="outlined" id="clear_b" onClick={handleClearBooks}>
            {"Clear Books"}
          </Button>

          <Button variant="outlined" id="print_b" onClick={handlePrint}>
            {"Print Preview"}
          </Button>
        </CardActions>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography
            color="textPrimary"
            display="inline"
          >
            {contentStatus}
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography
            color="textPrimary"
            display="inline"
          >
            {(importedBooks.length ? `Imported Books are: ${importedBooks.join(", ")}` : "No books imported yet")}
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
}
