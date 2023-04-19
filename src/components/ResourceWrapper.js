import React, { useState, useEffect, useContext } from "react";
import "../styles.css";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { AppContext } from '../App.context';
import Bible from './Bible';

export default function ResourceWrapper(propse) {
	const [resourceComponent, setResourceComponent] = useState(null);

	// app context
  const {
    state: {
      resourceInfo,
      html,
    },
    actions: {
      setHtml,
    },
  } = useContext(AppContext)

	useEffect(() => {
		if (! resourceInfo || ! resourceInfo.subject) {
			return;
		}

    console.log(resourceInfo);
		switch (resourceInfo.subject) {
			case "Aligned Bible":
			case "Bible":
				setResourceComponent(<Bible />);
				break;
			default:
				setHtml(`${resourceInfo.subject} is not yet supported.`);
		}
	}, [resourceInfo, setHtml]);

	return (
		<>
      <Card variant="outlined">
        <CardContent>
          <Typography
            color="textPrimary"
            gutterBottom
            display="inline"
          >
            {resourceInfo
              ?
                <><b>{"Owner:"}</b> {resourceInfo.owner} <b>{"Repo:"}</b> {resourceInfo.repo} <b>{resourceInfo.refType + ":"}</b> {resourceInfo.ref}{(resourceInfo.refType !== "Commit" ? " (" + resourceInfo.commitID + ")" : "")} <b>{'Language:'}</b> {resourceInfo.language} <a href={`https://git.door43.org/${resourceInfo.owner}/${resourceInfo.repo}/src/branch/${resourceInfo.ref}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px" }}>{"See on DCS"}</a></>
              :
                "Loading resource..."
              }
          </Typography>
        </CardContent>
      </Card>

      {resourceComponent}		

      <Card variant="outlined">
        <CardContent>
          <Typography
            color="textPrimary"
            display="inline"
            variant="body1"
          >
            <div dangerouslySetInnerHTML={{ __html: html.replace("columns: 2", "columns:  1").replace("span.footnote {float: footnote; }", "span.footnote {float: footnote;font-style: italic;font-size: .8em;padding: 5px; } span.footnote:before {content: '[f.n.: '} span.footnote:after {content: ']'}") }}></div>
          </Typography>
        </CardContent>
      </Card>
		</>
	)
}