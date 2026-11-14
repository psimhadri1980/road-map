package dev.roadmap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

/** 004-T003 (FR-012): the limits on names, requests, open Proposals and changes per Proposal. */
@SpringBootTest
@AutoConfigureMockMvc
class ProposalLimitsIT {

  @DynamicPropertySource
  static void services(DynamicPropertyRegistry registry) {
    Services.use(registry, Services.POSTGRES, Services.REDIS);
  }

  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String RENAME =
      "{\"entity\":\"task\",\"op\":\"update\",\"id\":\"t2\",\"fields\":{\"name\":\"n\"}}";

  @Autowired MockMvc mvc;
  String slug;
  String auth;

  @BeforeEach
  void fixture() throws Exception {
    slug = Services.insert(Services.sample());
    auth = Services.bearer("sample");
  }

  @AfterEach
  void clean() throws Exception {
    Services.clearProposals(slug);
    Services.delete(slug);
  }

  private String send(String path, String body) throws Exception {
    var r =
        mvc.perform(
                post("/api/roadmaps/" + slug + "/proposals" + path)
                    .header("Authorization", auth)
                    .contentType("application/json")
                    .content(body))
            .andReturn()
            .getResponse();
    return r.getStatus() + " " + r.getContentAsString();
  }

  private static String changes(int n) {
    return IntStream.range(0, n).mapToObj(i -> RENAME).collect(Collectors.joining(","));
  }

  private String idOf(String response) {
    return JSON.readTree(response.substring(4)).get("id").asString();
  }

  @Test
  void aNameOver200CharactersIsRefused() throws Exception {
    assertEquals("422", send("", "{\"name\":\"" + "x".repeat(201) + "\"}").substring(0, 3));
    assertEquals("201", send("", "{\"name\":\"" + "x".repeat(200) + "\"}").substring(0, 3));
  }

  @Test
  void atMost500ChangesPerRequest() throws Exception {
    String id = idOf(send("", "{\"name\":\"a\"}"));
    assertEquals(
        "422", send("/" + id + "/changes", "{\"changes\":[" + changes(501) + "]}").substring(0, 3));
    assertEquals(
        "200", send("/" + id + "/changes", "{\"changes\":[" + changes(500) + "]}").substring(0, 3));
    assertEquals(
        "422", send("", "{\"name\":\"b\",\"changes\":[" + changes(501) + "]}").substring(0, 3));
  }

  @Test
  void atMost5000ChangesPerProposal() throws Exception {
    String id = idOf(send("", "{\"name\":\"a\"}"));
    for (int i = 0; i < 10; i++) {
      assertEquals(
          "200",
          send("/" + id + "/changes", "{\"changes\":[" + changes(500) + "]}").substring(0, 3));
    }
    assertEquals(
        "422", send("/" + id + "/changes", "{\"changes\":[" + RENAME + "]}").substring(0, 3));
  }

  @Test
  void atMost50OpenProposalsPerOwnerOnARoadmap() throws Exception {
    for (int i = 0; i < 50; i++) {
      assertEquals("201", send("", "{\"name\":\"p" + i + "\"}").substring(0, 3));
    }
    assertEquals("422", send("", "{\"name\":\"one too many\"}").substring(0, 3));
  }
}
